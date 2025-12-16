var width = 960,
    height = 700;

var jsonData;
var cleanData;

const dimensions = [
    // --- 1. Métriques Climatiques (Conservées) ---
    "temperature",
    "humidity",
    "precipitation",
    "wind_speed",
    "wetbulb_temperature",

    //  --- 2. Métriques d'Efficacité/Fuites (Conservées) ---
    "WUE_FixedApproachDirect(L/KWh)",
    "WUE_FixedColdWaterDirect(L/KWh)",
    "WUE_Indirect(L/KWh)",
    "Leakages (%)",

    //  --- 3. Consommation Totale (TWh) (Conservée comme base) ---
    "Total energy - TWh",

    //  --- 4. Mix Énergétique (Remplacé par les Pourcentages) ---
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
    "Pct Other"                           
];

var currentDimension = dimensions[0];
var currentYear = "2022";

// Tooltip
var tooltip = d3.select('body').append('div').attr('class', 'hidden tooltip');

// SVG
var svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

var g = svg.append("g");

// Projection
var projection = d3.geoMercator()
    .center([20, 5])
    .scale(550)
    .translate([width / 2, height / 2]);

var path = d3.geoPath().projection(projection);

// Scale couleur
var color = d3.scaleLinear()
    .range(["#deebf7", "#08306b"]);

/* ----------------------------------------------------
   UTILITAIRE NUMÉRIQUE
---------------------------------------------------- */
function getDimensionValue(d, column = currentDimension) {
    if (!d || d[column] == null || d[column] === "") return NaN;

    let value = d[column];

    if (typeof value === "string") {
        value = value.replace(",", ".");
    }

    value = parseFloat(value);
    return Number.isFinite(value) ? value : NaN;
}

/* ----------------------------------------------------
   MISE À JOUR DU DOMAINE DES COULEURS
---------------------------------------------------- */
function updateColorDomain() {
    const vals = cleanData.map(d => getDimensionValue(d));
    const filtered = vals.filter(v => Number.isFinite(v));

    const min = d3.min(filtered);
    const max = d3.max(filtered);

    if (currentDimension.startsWith("Pct")) {
        color.domain([0, 100]);
    }
    else if (min == null || max == null) {
        color.domain([0,1]); 
        console.warn("Domaine couleur invalide (NaN).");
    } else {
        color.domain([min, max]);
    }
}

/* ----------------------------------------------------
   CHARGEMENT DES DONNÉES
---------------------------------------------------- */
Promise.all([
    d3.csv("../data/exported/country_year_cleaned.csv"),
    d3.json("custom.geo.json")
]).then(function([csvData, geojson]) {

    cleanData = csvData;
    jsonData = geojson;

    // groupe par pays
    const dataByCountry = d3.group(cleanData, d => d.country);

    // injection des données annuelles dans les features
    for (let feature of jsonData.features) {
        const countryName = feature.properties.name_long;
        const lignes = dataByCountry.get(countryName) || [];

        feature.properties.donneesAnnuelles = lignes.map(row => ({
            annee: String(row.year),
            data: row
        }));

        if (!lignes.length) {
            console.warn("⚠️ Pas de données CSV pour :", countryName);
        }
    }

    // Initialisation complète (dimension + carte)
    setupDimensionSelect();

    // Slider année
    d3.select("#year-slider").on("input", function() {
        currentYear = this.value;
        drawMap(currentYear);
        d3.select('#year').html(`Année : <strong>${currentYear}</strong>`);
    });

});


/* ----------------------------------------------------
   INITIALISATION DU SELECT (DIMENSION)
---------------------------------------------------- */
function setupDimensionSelect() {
    const selectElement = d3.select("#dim-select");
    const dimDisplay = d3.select('#dimension-name');

    // 🌟 FORCER une dimension initiale valide
    currentDimension = selectElement.property("value") || dimensions[0];
    dimDisplay.html(`Dimension : <strong>${currentDimension}</strong>`);

    updateColorDomain();   // maintenant cleanData existe
    drawMap(currentYear);  // 🌟 maintenant currentDimension est bon

    // changement utilisateur
    selectElement.on("change", function() {
        currentDimension = this.value;
        dimDisplay.html(`Dimension : <strong>${currentDimension}</strong>`);
        updateColorDomain();
        drawMap(currentYear);
    });
}


/* ----------------------------------------------------
   DRAW MAP
---------------------------------------------------- */
function drawMap(annee) {
    let carte = svg.selectAll("path").data(jsonData.features);

    carte.join("path")
        .attr("class", "country-path")
        .attr("d", path)
        .style("stroke", "white")
        .style("stroke-width", "0.5px")
        .style("fill", function(d) {

            const anneeData = d.properties.donneesAnnuelles.find(a => a.annee === annee);
            const value = anneeData ? getDimensionValue(anneeData.data) : NaN;

            return Number.isFinite(value) ? color(value) : "#ccc";
        })

        .on('mousemove', function(e, d) {
            const anneeData = d.properties.donneesAnnuelles.find(a => a.annee === annee);
            const rawValue = anneeData ? getDimensionValue(anneeData.data) : NaN;

            const valueDisplay = Number.isFinite(rawValue)
                ? rawValue.toFixed(2)
                : "N/D";

            tooltip.classed('hidden', false)
                .style('left', (e.pageX + 15) + 'px')
                .style('top', (e.pageY - 35) + 'px')
                .html(`
                    <strong>${d.properties.name_long}</strong><br>
                    ${currentDimension}: <strong>${valueDisplay}</strong>
                `);
        })
        .on('mouseout', function() {
            tooltip.classed('hidden', true);
        })

        .transition()
        .duration(500);
}
