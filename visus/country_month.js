/********************************************
 * CONFIGURATION GLOBALE
 ********************************************/
const width = 960;
const height = 700;

let jsonData;
let cleanData;

// Dimensions numériques + catégorielle
const dimensions = [
    // --- 1. Métriques Climatiques ---
    "temperature",
    "humidity",
    "precipitation",
    "wind_speed",
    "wetbulb_temperature",

    //  --- 2. Métriques d'Efficacité/Fuites ---
    "WUE_FixedApproachDirect(L/KWh)",
    "WUE_FixedColdWaterDirect(L/KWh)",
    "WUE_Indirect(L/KWh)",
    "Leakages (%)",

    //  --- 3. Consommation Totale (TWh) ---
    "Total energy - TWh",

    //  --- 4. Mix Énergétique (Pourcentages) ---
    "Pct renewables",                     
    "Pct fossil fuels",                   
    "Pct Coal consumption",               
    "Pct Gas consumption",                
    "Pct Oil consumption",                
    "Pct Nuclear consumption",            
    "Pct Solar consumption",              
    "Pct Hydro consumption",              
    "Pct Wind consumption",               
    "Pct Biofuels consumption",           
    "Pct Low carbon",                     
    "Pct Other renewables",               
    "Pct Other",
    "climate_region"
];

// Timeline EXACTE (2022/08 → 2024/08)
const timeline = [];
for (let year = 2022; year <= 2024; year++) {
    let startMonth = 1, endMonth = 12;

    if (year === 2022) startMonth = 8;
    if (year === 2024) endMonth = 8;

    for (let month = startMonth; month <= endMonth; month++) {
        timeline.push(`${year}/${String(month).padStart(2, "0")}`);
    }
}

let currentTimeIndex = 0;
let currentYearMonth = timeline[0]; // "2022/08"
let currentDimension = dimensions[0]; // dimension initiale

/********************************************
 * TOOLTIP & SVG
 ********************************************/
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "hidden tooltip");

const svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const g = svg.append("g");

/********************************************
 * PROJECTION & COLOR SCALES
 ********************************************/
const projection = d3.geoMercator()
    .center([20, 5])
    .scale(550)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

// Couleurs numériques
const colorNumeric = d3.scaleLinear()
    .range(["#deebf7", "#08306b"]);

// Couleurs catégorielles
const colorCategorical = d3.scaleOrdinal()
    .range(d3.schemeSet2);

/********************************************
 * GET VALUE (numérique OU catégorielle)
 ********************************************/
function getValue(d, dim = currentDimension) {
    const val = d[dim];

    if (dim === "climate_region") {
        return val ? val : null;
    }

    // Gère null, undefined, ou chaînes vides
    if (val == null || val === "") return null;

    let num = parseFloat(val.toString().replace(",", "."));
    // Retourne null si la valeur n'est pas un nombre fini (inclut NaN, Infinity)
    return isFinite(num) ? num : null;
}

/********************************************
 * UPDATE COLOR DOMAIN (NUM ONLY)
 ********************************************/
function updateColorDomain() {

    if (currentDimension === "climate_region") return;

    // --- CORRECTION CLÉ: DOMAINE FIXE POUR LES POURCENTAGES ---
    // Si la dimension est un pourcentage (Pct...) ou Fuites (%), le domaine est fixe [0, 100]
    if (currentDimension.startsWith("Pct") || currentDimension.includes("Leakages")) {
         colorNumeric.domain([0, 100]);
         return;
    }

    const values = cleanData
        .map(d => getValue(d))
        .filter(v => v != null);

    const min = d3.min(values);
    const max = d3.max(values);
    
    // Fallback si aucune donnée n'est valide ou si min == max
    if (min == null || max == null || min === max) {
         colorNumeric.domain([0, 1]); // Fallback
         // console.warn(`⚠️ Domaine couleur invalide pour ${currentDimension}.`);
    } else {
         colorNumeric.domain([min, max]);
    }
}

/********************************************
 * LOAD DATA
 ********************************************/
d3.csv("../data/exported/country_month_cleaned.csv").then(function (data) {
    cleanData = data;

    // Indexation rapide par pays
    const dataByCountry = d3.group(cleanData, d => d.country);

    d3.json("custom.geo.json").then(function (json) {
        jsonData = json;

        // Fusion GeoJSON + CSV
        for (let feature of jsonData.features) {
            const name = feature.properties.name_long;
            const rows = dataByCountry.get(name) || [];

            feature.properties.donneesMensuelles = rows.map(row => ({
                time: `${row.year}/${String(row.month).padStart(2, "0")}`,
                data: row
            }));
        }

        // --- CORRECTION CLÉ: APPEL DES BONNES FONCTIONS ---
        setupDimensionSlider();
        setupTimeSlider();
        
        // La dimension actuelle est maintenant initialisée dans setupDimensionSlider
        updateColorDomain();
        drawMap(currentYearMonth);
    });
});

/********************************************
 * SLIDER DE DIMENSIONS (CORRECTION ID)
 ********************************************/
function setupDimensionSlider() {
    // ID HTML: #dim-slider
    const slider = d3.select("#dim-slider");
    const disp = d3.select("#dimension-name");

    // Configuration du slider range
    slider
        .attr("min", 0)
        .attr("max", dimensions.length - 1)
        .attr("value", 0)
        .on("input", function () {
            currentDimension = dimensions[+this.value];
            disp.html(`<strong>${currentDimension}</strong>`);

            updateColorDomain();
            drawMap(currentYearMonth);
        });

    // Initialisation
    currentDimension = dimensions[+slider.property("value")];
    disp.html(`<strong>${currentDimension}</strong>`);
}

/********************************************
 * SLIDER TEMPOREL (CORRECTION ID)
 ********************************************/
function setupTimeSlider() {

    // ID HTML: #time-slider
    const slider = d3.select("#time-slider");
    // ID HTML: #time-label
    const label = d3.select("#time-label");
    // ID HTML: #year (Div pour l'affichage principal)
    const yearDisplay = d3.select("#year"); 

    slider
        .attr("min", 0)
        .attr("max", timeline.length - 1)
        .attr("value", currentTimeIndex)
        .on("input", function () {
            currentTimeIndex = +this.value;
            currentYearMonth = timeline[currentTimeIndex];

            // Mise à jour de tous les éléments
            label.html(`Période : <strong>${currentYearMonth}</strong>`);
            yearDisplay.html(`Période : <strong>${currentYearMonth}</strong>`);
            drawMap(currentYearMonth);
        });

    // Initialisation de la période affichée
    label.html(`Période : <strong>${currentYearMonth}</strong>`);
    yearDisplay.html(`Période : <strong>${currentYearMonth}</strong>`);
}

/********************************************
 * DRAW MAP
 ********************************************/
function drawMap(time) {

    // L'affichage de la période est géré par setupTimeSlider
    // d3.select("#year").html(`Période : <strong>${time}</strong>`); est maintenant dans setupTimeSlider

    let countries = svg.selectAll("path")
        .data(jsonData.features);

    countries.join("path")
        .attr("class", "country-path")
        .attr("d", path)
        .style("stroke", "white")
        .style("stroke-width", "0.5px")
        .on("mousemove", function (e, d) {

            const row = d.properties.donneesMensuelles.find(r => r.time === time);
            const rawVal = row ? getValue(row.data) : null;
            
            let valDisplay;

            if (currentDimension === "climate_region") {
                valDisplay = rawVal ?? "N/D";
            } else if (rawVal != null) {
                // Arrondi et ajout du symbole %
                valDisplay = rawVal.toFixed(2);
                if (currentDimension.startsWith("Pct") || currentDimension.includes("Leakages")) {
                    valDisplay += " %";
                }
            } else {
                valDisplay = "N/D";
            }
            
            tooltip.classed("hidden", false)
                .style("left", (e.pageX + 15) + "px")
                .style("top", (e.pageY - 35) + "px")
                .html(`
                    <strong>${d.properties.name_long}</strong><br>
                    ${currentDimension} : <strong>${valDisplay}</strong>
                `);
        })
        .on("mouseout", () => tooltip.classed("hidden", true))
        .transition()
        .duration(500)
        .style("fill", function (d) {

            const row = d.properties.donneesMensuelles.find(r => r.time === time);
            const val = row ? getValue(row.data) : null;

            // Catégoriel
            if (currentDimension === "climate_region") {
                return val ? colorCategorical(val) : "#ccc";
            }

            // Numérique
            return val != null ? colorNumeric(val) : "#ccc";
        });
}