// --- Configuration ---
const margin = { top: 40, right: 180, bottom: 50, left: 60 };
const width = 960 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Sélection des colonnes à visualiser
const keys = [
    "Coal consumption - TWh",
    "Oil consumption - TWh", 
    "Gas consumption - TWh",
    "Low carbon - TWh"
];

// Couleurs
const colorScale = d3.scaleOrdinal()
  .domain(keys)
  .range(["#2c3e50", "#e74c3c", "#95a5a6", "#27ae60"]);

// Labels
const labels = {
    "Coal consumption - TWh": "Charbon",
    "Oil consumption - TWh": "Pétrole",
    "Gas consumption - TWh": "Gaz",
    "Low carbon - TWh": "Bas Carbone (Renouvelables)"
};

// --- Initialisation du SVG ---
const svg = d3.select("#chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top + margin.bottom)
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

// Tooltip
const tooltip = d3.select("#tooltip");

// Variables globales pour les données
let monthlyData = [];
let yearlyData = [];
let climateData = [];

// --- Fonction pour compter les sources d'énergie actives ---
function countEnergySources(countryDataArray) {
    // Agrège toutes les valeurs pour le pays
    const totals = {
        coal: 0,
        oil: 0,
        gas: 0,
        lowcarbon: 0
    };
    
    countryDataArray.forEach(d => {
        totals.coal += d["Coal consumption - TWh"] || 0;
        totals.oil += d["Oil consumption - TWh"] || 0;
        totals.gas += d["Gas consumption - TWh"] || 0;
        totals.lowcarbon += d["Low carbon - TWh"] || 0;
    });
    
    // Compte combien de sources sont significatives (> 1 TWh au total)
    let activeCount = 0;
    if (totals.coal > 1) activeCount++;
    if (totals.oil > 1) activeCount++;
    if (totals.gas > 1) activeCount++;
    if (totals.lowcarbon > 1) activeCount++;
    
    return activeCount;
}

// --- Chargement des Données ---
Promise.all([
    d3.csv("../data/exported/country_month_cleaned.csv"),
    d3.csv("../data/exported/country_year_cleaned.csv"),
    d3.csv("../data/exported/climate_summary.csv")
]).then(([dataMonth, dataYear, dataClimate]) => {
    
    // 1. Parsing des données mensuelles
    dataMonth.forEach(d => {
        d.date = new Date(+d.year, +d.month - 1, 1);
        keys.forEach(k => d[k] = +d[k] || 0);
        d.climate_region = d.climate_region || "Non défini";
    });
    dataMonth.sort((a, b) => a.date - b.date);
    monthlyData = dataMonth;
    
    // 2. Parsing des données annuelles
    dataYear.forEach(d => {
        d.year = +d.year;
        keys.forEach(k => d[k] = +d[k] || 0);
        d.climate_region = d.climate_region || "Non défini";
    });
    yearlyData = dataYear;
    
    // 3. Données climatiques
    climateData = dataClimate;
    
    // 4. Analyse des pays multi-sources vs mono-source
    const countrySourceCount = new Map();
    const countries = Array.from(new Set(monthlyData.map(d => d.country)));
    
    countries.forEach(country => {
        const countryData = monthlyData.filter(d => d.country === country);
        const sourceCount = countEnergySources(countryData);
        const region = countryData[0].climate_region;
        countrySourceCount.set(country, { count: sourceCount, region: region });
    });
    
    // 5. Gestion des Filtres
    const regions = Array.from(new Set(monthlyData.map(d => d.climate_region))).sort();
    
    const regionSelect = d3.select("#regionSelect");
    regions.forEach(r => {
        regionSelect.append("option").text(r).attr("value", r);
    });
    
    // Fonction pour filtrer les pays
    function updateCountryOptions(region) {
        const filteredData = (region === "all") ? monthlyData : monthlyData.filter(d => d.climate_region === region);
        const countries = Array.from(new Set(filteredData.map(d => d.country))).sort();
        
        // Séparer les pays multi-sources et mono-source
        const multiSourceCountries = [];
        const singleSourceCountries = [];
        
        countries.forEach(c => {
            const info = countrySourceCount.get(c);
            if (info && info.count >= 2) {
                multiSourceCountries.push(c);
            } else {
                singleSourceCountries.push(c);
            }
        });
        
        const countrySelect = d3.select("#countrySelect");
        countrySelect.html("");
        
        // Ajouter les pays multi-sources
        if (multiSourceCountries.length > 0) {
            const optgroupMulti = countrySelect.append("optgroup")
                .attr("label", `Pays Multi-Sources (${multiSourceCountries.length})`);
            multiSourceCountries.forEach(c => {
                optgroupMulti.append("option").text(c).attr("value", c);
            });
        }
        
        // Ajouter les pays mono-source
        if (singleSourceCountries.length > 0) {
            const optgroupSingle = countrySelect.append("optgroup")
                .attr("label", `Pays Mono-Source (${singleSourceCountries.length})`);
            singleSourceCountries.forEach(c => {
                optgroupSingle.append("option").text(c).attr("value", c);
            });
        }
        
        // Afficher les statistiques
        updateStats(region, multiSourceCountries.length, singleSourceCountries.length);
        
        // Initialiser avec le premier pays multi-source si disponible
        if (multiSourceCountries.length > 0) {
            countrySelect.property("value", multiSourceCountries[0]);
            updateChart(multiSourceCountries[0]);
        } else if (singleSourceCountries.length > 0) {
            countrySelect.property("value", singleSourceCountries[0]);
            updateChart(singleSourceCountries[0]);
        } else {
            svg.selectAll("*").remove();
        }
    }
    
    // Fonction pour afficher les statistiques
    function updateStats(region, multiCount, singleCount) {
        const statsDiv = d3.select("#stats");
        const regionText = region === "all" ? "Toutes régions" : region;
        statsDiv.html(`
            <strong>Statistiques :</strong> ${regionText} - 
            <span style="color: #27ae60;">${multiCount} pays multi-sources</span> | 
            <span style="color: #e67e22;">${singleCount} pays mono-source</span>
        `);
    }
    
    // Initialisation
    updateCountryOptions("all");
    
    // Écouteurs d'événements
    d3.select("#regionSelect").on("change", function() {
        updateCountryOptions(this.value);
    });
    
    d3.select("#countrySelect").on("change", function() {
        updateChart(this.value);
    });
    
    d3.select("#viewToggle").on("change", function() {
        const currentCountry = d3.select("#countrySelect").property("value");
        updateChart(currentCountry);
    });
    
    // 6. Fonction de Dessin
    function updateChart(selectedCountry) {
        const viewType = d3.select("#viewToggle").property("value");
        
        // Choisir les données selon la vue
        let countryData;
        let isYearlyView = false;
        
        if (viewType === "yearly") {
            countryData = yearlyData.filter(d => d.country === selectedCountry);
            isYearlyView = true;
            // Créer des dates pour les années
            countryData.forEach(d => {
                d.date = new Date(d.year, 0, 1);
            });
        } else {
            countryData = monthlyData.filter(d => d.country === selectedCountry);
        }
        
        if (countryData.length === 0) {
            svg.selectAll("*").remove();
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .text("Aucune donnée disponible pour ce pays");
            return;
        }
        
        // Échelles
        const x = d3.scaleTime()
          .domain(d3.extent(countryData, d => d.date))
          .range([0, width]);
        
        const yMax = d3.max(countryData, d => {
            return keys.reduce((acc, k) => acc + d[k], 0);
        });
        
        const yDomainMax = yMax ? yMax * 1.1 : 100;
        
        const y = d3.scaleLinear()
          .domain([0, yDomainMax])
          .range([height, 0]);
        
        // Stack Generator
        const stackedData = d3.stack()
          .keys(keys)
          (countryData);
        
        const area = d3.area()
          .x(d => x(d.data.date))
          .y0(d => y(d[0]))
          .y1(d => y(d[1]));
        
        // Nettoyage
        svg.selectAll("*").remove();
        
        // Axe X
        const xAxis = isYearlyView ? d3.axisBottom(x).ticks(d3.timeYear.every(1)) : d3.axisBottom(x).ticks(8);
        svg.append("g")
          .attr("transform", `translate(0,${height})`)
          .call(xAxis)
          .attr("class", "axis");
        
        // Axe Y
        svg.append("g")
          .call(d3.axisLeft(y))
          .attr("class", "axis");
        
        // Titre Axe Y
        svg.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", -40)
          .attr("x", -height / 2)
          .style("text-anchor", "middle")
          .text("Consommation (TWh)");
        
        // Grille
        svg.append("g")
          .attr("class", "grid")
          .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));
        
        // Dessin des aires
        svg.selectAll(".layer")
          .data(stackedData)
          .join("path")
          .attr("class", "layer")
          .attr("d", area)
          .style("fill", d => colorScale(d.key))
          .style("opacity", 0.85)
          .on("mouseover", function(event, d) {
                d3.select(this).style("opacity", 1).style("stroke", "#333").style("stroke-width", "2px");
            })
          .on("mousemove", function(event, d) {
                const label = labels[d.key];
                tooltip.style("opacity", 1)
                  .html(`<strong>${label}</strong>`)
                  .style("left", (event.pageX + 15) + "px")
                  .style("top", (event.pageY - 28) + "px");
            })
          .on("mouseout", function() {
                d3.select(this).style("opacity", 0.85).style("stroke", "none");
                tooltip.style("opacity", 0);
            });
        
        // Légende
        const legend = svg.selectAll(".legend")
          .data(keys.slice().reverse()) 
          .enter().append("g")
          .attr("transform", (d, i) => `translate(${width + 20}, ${i * 25})`);
        
        legend.append("rect")
          .attr("width", 15)
          .attr("height", 15)
          .style("fill", d => colorScale(d));
        
        legend.append("text")
          .attr("x", 25)
          .attr("y", 12)
          .text(d => labels[d])
          .style("font-size", "12px")
          .attr("alignment-baseline", "middle");
        
        // Titre
        const viewText = isYearlyView ? "(Vue Annuelle)" : "(Vue Mensuelle)";
        svg.append("text")
          .attr("x", width / 2)
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("font-weight", "bold")
          .text(`Mix Énergétique : ${selectedCountry} ${viewText}`);
    }
    
}).catch(error => {
    console.error("Error loading data:", error);
    d3.select("#chart").append("p")
      .style("color", "red")
      .text("Erreur lors du chargement des données. Vérifiez les chemins des fichiers CSV.");
});