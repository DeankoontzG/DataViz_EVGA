/********************************************
 * CONFIGURATION & TIMELINE
 ********************************************/
const width = 960;
const height = 700;
const currentDimension = "WUE_FixedColdWaterDirect(L/KWh)";

// Génération de la timeline 2022/08 → 2024/08
const timeline = [];
for (let year = 2022; year <= 2024; year++) {
    let start = (year === 2022) ? 8 : 1;
    let end = (year === 2024) ? 8 : 12;
    for (let month = start; month <= end; month++) {
        timeline.push(`${year}/${String(month).padStart(2, "0")}`);
    }
}

let currentTimeIndex = 0;
let timer = null;
let geoDataGlobal = null;

const svg = d3.select("#map-holder").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);
const g = svg.append("g");

const projection = d3.geoMercator()
    .center([20, 5]).scale(550).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);

const colorScale = d3.scaleSequential(d3.interpolateBlues);
const tooltip = d3.select("body").append("div").attr("class", "hidden tooltip");

/********************************************
 * CHARGEMENT DES DONNÉES
 ********************************************/
Promise.all([
    d3.csv("../data/exported/country_month_cleaned.csv"),
    d3.json("custom.geo.json")
]).then(([csvData, geoJson]) => {
    
    // 1. Calcul du domaine de couleur (fixe pour toute la période)
    const allValues = csvData.map(d => parseFloat(d[currentDimension]?.toString().replace(",", ".")))
                             .filter(v => isFinite(v));
    colorScale.domain([0, d3.max(allValues)]);

    // 2. Préparation des données Géo
    const dataByCountry = d3.group(csvData, d => d.country);
    geoJson.features.forEach(f => {
        const rows = dataByCountry.get(f.properties.name_long) || [];
        f.properties.history = rows.reduce((acc, r) => {
            acc[`${r.year}/${String(r.month).padStart(2, "0")}`] = r;
            return acc;
        }, {});
    });

    geoDataGlobal = geoJson;
    initControls();
    updateMap(timeline[0]);
});

/********************************************
 * LOGIQUE DES CONTRÔLES (PLAY & MANUEL)
 ********************************************/
function initControls() {
    const slider = d3.select("#time-slider")
        .attr("min", 0)
        .attr("max", timeline.length - 1)
        .attr("value", 0);

    // Contrôle Manuel
    slider.on("input", function() {
        stopAnimation();
        currentTimeIndex = +this.value;
        updateMap(timeline[currentTimeIndex]);
    });

    // Contrôle Automatique (Play)
    d3.select("#play-button").on("click", function() {
        if (timer) {
            stopAnimation();
        } else {
            if (currentTimeIndex >= timeline.length - 1) currentTimeIndex = 0;
            startAnimation();
            this.textContent = "Pause";
        }
    });
}

function startAnimation() {
    timer = setInterval(() => {
        currentTimeIndex++;
        if (currentTimeIndex < timeline.length) {
            d3.select("#time-slider").property("value", currentTimeIndex);
            updateMap(timeline[currentTimeIndex]);
        } else {
            stopAnimation();
        }
    }, 600);
}

function stopAnimation() {
    clearInterval(timer);
    timer = null;
    d3.select("#play-button").textContent = "Play";
}

/********************************************
 * MISE À JOUR DE LA CARTE
 ********************************************/
function updateMap(time) {
    d3.select("#time-label").text(time);

    const countries = g.selectAll(".country")
        .data(geoDataGlobal.features);

    countries.join("path")
        .attr("class", "country")
        .attr("d", path)
        .style("stroke", "#fff")
        .style("stroke-width", "0.5px")
        .on("mousemove", (e, d) => {
            const row = d.properties.history[time];
            const val = row ? parseFloat(row[currentDimension]?.toString().replace(",", ".")) : null;
            
            tooltip.classed("hidden", false)
                .style("left", (e.pageX + 15) + "px")
                .style("top", (e.pageY - 35) + "px")
                .html(`<strong>${d.properties.name_long}</strong><br>WUE: ${val ? val.toFixed(2) : "N/D"}`);
        })
        .on("mouseout", () => tooltip.classed("hidden", true))
        .transition()
        .duration(400)
        .style("fill", d => {
            const row = d.properties.history[time];
            if (!row) return "#ccc";
            const val = parseFloat(row[currentDimension]?.toString().replace(",", "."));
            return isFinite(val) ? colorScale(val) : "#ccc";
        });
}