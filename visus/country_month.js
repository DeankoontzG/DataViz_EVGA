/********************************************
 * CONFIGURATION GLOBALE
 ********************************************/
var width = 960;
var height = 700;

var jsonData;
var cleanData;

// Dimensions numériques + catégorielle
const dimensions = [
    "temperature",
    "humidity",
    "precipitation",
    "wind_speed",
    "wetbulb_temperature",
    "WUE_FixedApproachDirect(L/KWh)",
    "WUE_FixedColdWaterDirect(L/KWh)",
    "WUE_Indirect(L/KWh)",
    "Leakages (%)",
    "Total energy - TWh",
    "Total renewables - TWh",
    "Total fossil fuels - TWh",
    "Coal consumption - TWh",
    "Gas consumption - TWh",
    "Oil consumption - TWh",
    "Low carbon - TWh",
    "Other - TWh",
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
var tooltip = d3.select("body")
    .append("div")
    .attr("class", "hidden tooltip");

var svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

var g = svg.append("g");

/********************************************
 * PROJECTION & COLOR SCALES
 ********************************************/
var projection = d3.geoMercator()
    .center([20, 5])
    .scale(550)
    .translate([width / 2, height / 2]);

var path = d3.geoPath().projection(projection);

// Couleurs numériques
var colorNumeric = d3.scaleLinear()
    .range(["#deebf7", "#08306b"]);

// Couleurs catégorielles
var colorCategorical = d3.scaleOrdinal()
    .range(d3.schemeSet2);

/********************************************
 * GET VALUE (numérique OU catégorielle)
 ********************************************/
function getValue(d, dim = currentDimension) {
    const val = d[dim];

    if (dim === "climate_region") {
        return val ? val : null;
    }

    if (val == null) return null;

    let num = parseFloat(val.toString().replace(",", "."));
    return isFinite(num) ? num : null;
}

/********************************************
 * UPDATE COLOR DOMAIN (NUM ONLY)
 ********************************************/
function updateColorDomain() {

    if (currentDimension === "climate_region") return;

    const values = cleanData
        .map(d => getValue(d))
        .filter(v => v != null);

    colorNumeric.domain([d3.min(values), d3.max(values)]);
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

        setupDimensionSlider();
        setupTimeSlider();
        updateColorDomain();
        drawMap(currentYearMonth);
    });
});

/********************************************
 * SLIDER DE DIMENSIONS
 ********************************************/
function setupDimensionSlider() {
    const slider = d3.select("#dim-slider");
    const disp = d3.select("#dimension-name");

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

    disp.html(`<strong>${currentDimension}</strong>`);
}

/********************************************
 * SLIDER TEMPOREL (25 mois)
 ********************************************/
function setupTimeSlider() {

    const slider = d3.select("#time-slider");
    const label = d3.select("#time-label");

    slider
        .attr("min", 0)
        .attr("max", timeline.length - 1)
        .attr("value", currentTimeIndex)
        .on("input", function () {
            currentTimeIndex = +this.value;
            currentYearMonth = timeline[currentTimeIndex];

            label.html(`<strong>${currentYearMonth}</strong>`);
            drawMap(currentYearMonth);
        });

    label.html(`<strong>${currentYearMonth}</strong>`);
}

/********************************************
 * DRAW MAP
 ********************************************/
function drawMap(time) {

    d3.select("#year")
        .html(`Période : <strong>${time}</strong>`);

    let countries = svg.selectAll("path")
        .data(jsonData.features);

    countries.join("path")
        .attr("class", "country-path")
        .attr("d", path)
        .style("stroke", "white")
        .style("stroke-width", "0.5px")
        .on("mousemove", function (e, d) {

            const row = d.properties.donneesMensuelles.find(r => r.time === time);
            const val = row ? getValue(row.data) : null;

            tooltip.classed("hidden", false)
                .style("left", (e.pageX + 15) + "px")
                .style("top", (e.pageY - 35) + "px")
                .html(`
                    <strong>${d.properties.name_long}</strong><br>
                    ${currentDimension} : <strong>${val ?? "N/D"}</strong>
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
