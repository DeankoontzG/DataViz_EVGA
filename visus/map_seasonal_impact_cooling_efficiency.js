/********************************************
 * CONFIGURATION & ÉCHELLE
 ********************************************/
const width = 960;
const height = 750;
const currentDimension = "WUE_FixedColdWaterDirect(L/KWh)";

const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", 
                "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

let currentTimeIndex = 0;
let timer = null;
let geoDataGlobal = null;

const svg = d3.select("#map-holder").append("svg").attr("viewBox", `0 0 ${width} ${height}`);
const g = svg.append("g");

// CORRECTION : Projection dézoomée (scale 150 au lieu de 500) pour voir l'Afrique entière
const projection = d3.geoMercator()
    .center([15, 10]) 
    .scale(550)       
    .translate([width / 2, height / 2 - 80]);

const path = d3.geoPath().projection(projection);

const colorScale = d3.scaleLinear()
    .range(["#ebf3fb", "#08306b"]);

const colorNoData = "#d1d1d1"; 

// CORRECTION : On s'assure que le tooltip est bien créé dans le body
const tooltip = d3.select("body")
    .append("div")
    .attr("class", "hidden tooltip");

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

    const allMeans = geoJson.features.flatMap(f => Object.values(f.properties.averages)).filter(v => v != null);
    const minVal = d3.min(allMeans);
    const maxVal = d3.max(allMeans);

    colorScale.domain([minVal * 0.95, maxVal]);

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
        stopAnimation(); // Arrête l'auto-play si on touche au slider
        currentTimeIndex = (+this.value) - 1;
        updateMap(+this.value);
    });

    d3.select("#play-button").on("click", function() {
        if (timer) {
            stopAnimation();
        } else {
            if (currentTimeIndex >= 11) currentTimeIndex = -1;
            startAnimation();
            d3.select(this).text("Pause"); // Change le texte au clic
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
    // CORRECTION : Réinitialise toujours le bouton sur "Play"
    d3.select("#play-button").text("Play");
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
        .style("stroke", "#ffffff")
        .style("stroke-width", "0.4px")
        .on("mousemove", (e, d) => {
            const val = d.properties.averages[monthNum];
            // CORRECTION : Utilisation de pageX/Y et z-index CSS pour le split-screen
            tooltip.classed("hidden", false)
                .style("left", (e.pageX + 15) + "px")
                .style("top", (e.pageY - 20) + "px")
                .html(`<strong>${d.properties.name_long}</strong><br>Moyenne ${months[monthNum-1]}: <strong>${val ? val.toFixed(2) : "N/D"}</strong> L/kWh`);
        })
        .on("mouseout", () => tooltip.classed("hidden", true))
        .transition()
        .duration(500)
        .style("fill", d => {
            const val = d.properties.averages[monthNum];
            return (val != null) ? colorScale(val) : colorNoData;
        });
}