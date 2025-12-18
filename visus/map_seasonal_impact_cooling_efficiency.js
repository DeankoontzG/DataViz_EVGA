/********************************************
 * CONFIGURATION & ÉCHELLE
 ********************************************/
const width = 960;
const height = 650;
const currentDimension = "WUE_FixedColdWaterDirect(L/KWh)";

const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
                "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

let currentTimeIndex = 0;
let timer = null;
let geoDataGlobal = null;

const svg = d3.select("#map-holder").append("svg").attr("viewBox", `0 0 ${width} ${height}`);
const g = svg.append("g");
const projection = d3.geoMercator().center([20, 10]).scale(500).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);

// TON ÉCHELLE PRÉFÉRÉE (Linéaire Bleu clair -> Bleu foncé)
const colorScale = d3.scaleLinear()
    .range(["#deebf7", "#08306b"]);

const tooltip = d3.select("body").append("div").attr("class", "hidden tooltip");

/********************************************
 * CHARGEMENT ET CALCUL
 ********************************************/
Promise.all([
    d3.csv("../data/exported/country_month_cleaned.csv"),
    d3.json("custom.geo.json")
]).then(([csvData, geoJson]) => {

    csvData.forEach(d => {
        d.val = parseFloat(d[currentDimension]?.toString().replace(",", "."));
        d.monthNum = parseInt(d.month);
    });

    const dataByCountry = d3.group(csvData, d => d.country);
    
    geoJson.features.forEach(f => {
        const rows = dataByCountry.get(f.properties.name_long) || [];
        f.properties.averages = {}; 

        const byMonth = d3.group(rows, r => r.monthNum);
        byMonth.forEach((vals, m) => {
            const validVals = vals.map(v => v.val).filter(v => isFinite(v));
            f.properties.averages[m] = validVals.length > 0 ? d3.mean(validVals) : null;
        });
    });

    // On fixe le domaine sur le maximum de toutes les moyennes calculées
    const allMeans = geoJson.features.flatMap(f => Object.values(f.properties.averages)).filter(v => v != null);
    colorScale.domain([0, d3.max(allMeans)]);

    geoDataGlobal = geoJson;
    initControls();
    updateMap(1); 
});

/********************************************
 * CONTRÔLES (PLAY / MANUEL)
 ********************************************/
function initControls() {
    const slider = d3.select("#time-slider")
        .attr("min", 1)
        .attr("max", 12)
        .attr("value", 1);

    slider.on("input", function() {
        stopAnimation();
        currentTimeIndex = (+this.value) - 1;
        updateMap(+this.value);
    });

    d3.select("#play-button").on("click", function() {
        if (timer) {
            stopAnimation();
        } else {
            if (currentTimeIndex >= 11) currentTimeIndex = -1;
            startAnimation();
            this.textContent = "Pause";
        }
    });
}

function startAnimation() {
    timer = setInterval(() => {
        currentTimeIndex++;
        if (currentTimeIndex < 12) {
            const monthNum = currentTimeIndex + 1;
            d3.select("#time-slider").property("value", monthNum);
            updateMap(monthNum);
        } else {
            stopAnimation();
        }
    }, 800);
}

function stopAnimation() {
    clearInterval(timer);
    timer = null;
    d3.select("#play-button").textContent = "Play";
}

/********************************************
 * RENDU DE LA CARTE
 ********************************************/
function updateMap(monthNum) {
    d3.select("#time-label").text(months[monthNum - 1]);

    g.selectAll(".country")
        .data(geoDataGlobal.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .style("stroke", "#fff")
        .style("stroke-width", "0.3px")
        .on("mousemove", (e, d) => {
            const val = d.properties.averages[monthNum];
            tooltip.classed("hidden", false)
                .style("left", (e.pageX + 15) + "px")
                .style("top", (e.pageY - 35) + "px")
                .html(`<strong>${d.properties.name_long}</strong><br>Moyenne ${months[monthNum-1]}: ${val ? val.toFixed(2) : "N/D"}`);
        })
        .on("mouseout", () => tooltip.classed("hidden", true))
        .transition()
        .duration(400)
        .style("fill", d => {
            const val = d.properties.averages[monthNum];
            // Si pas de donnée, on met un gris très léger pour ne pas distraire du bleu
            return (val != null) ? colorScale(val) : "#f0f0f0";
        });
}