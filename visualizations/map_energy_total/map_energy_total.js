(function() {
    // Configuration spécifique au Fichier 1
    const width = 960;
    const height = 750;
    const sidePanelWidth = 350;
    const currentYear = "2023";
    const mainDimension = "Total energy - TWh";

    // Sélection du conteneur HTML spécifique
    const svg = d3.select("#energy-map-holder")
      .append("svg")
      .attr("viewBox", `0 0 ${width + sidePanelWidth} ${height}`);

    const mapGroup = svg.append("g");
    const panelGroup = svg.append("g")
      .attr("transform", `translate(${width + 20}, 40)`);

    const tooltip = d3.select("#tooltip");

    const projection = d3.geoMercator()
      .center([20, 5])
      .scale(550)
      .translate([width / 2, height / 2 - 40]);

    const path = d3.geoPath().projection(projection);

    const color = d3.scaleLinear()
      .range(["#f3efe6", "#b11226", "#000000"]);

    function getVal(row, col) {
      if (!row || row[col] == null || row[col] === "") return NaN;
      return +String(row[col]).replace(",", ".");
    }

    // Chargement des données
    Promise.all([
      d3.csv("../../data/exported/country_year_cleaned.csv"),
      d3.json("../shared/custom.geo.json")
    ]).then(([csv, geo]) => {
      const data2023 = csv.filter(d => String(d.year) === currentYear);
      const dataByCountry = d3.group(data2023, d => d.country);

      geo.features.forEach(f => {
        const name = f.properties.name_long;
        f.properties.data = dataByCountry.get(name)?.[0] || null;
      });

      const values = geo.features
        .map(f => getVal(f.properties.data, mainDimension))
        .filter(v => Number.isFinite(v));

      color.domain([0, d3.max(values)]);

      drawMap(geo);
      drawEmptyPanel();
    });

    function drawMap(geo) {
      mapGroup.selectAll("path")
        .data(geo.features)
        .join("path")
        .attr("d", path)
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .attr("fill", d => {
          const v = getVal(d.properties.data, mainDimension);
          return Number.isFinite(v) ? color(v) : "#ccc";
        })
        .on("mousemove", (e, d) => {
          const v = getVal(d.properties.data, mainDimension);
          tooltip.style("opacity", 1) // On affiche
            .style("left", e.pageX + 15 + "px")
            .style("top", e.pageY - 30 + "px")
            .html(`<strong>${d.properties.name_long}</strong><br>${Number.isFinite(v) ? Math.round(v) + " TWh" : "N/D"}`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0))
        .on("click", (_, d) => updatePanel(d));
    }

    // ===============================
    // PANEL DROIT – STACKED BAR (MIX ÉNERGÉTIQUE)
    // ===============================
    function updatePanel(feature) {

      panelGroup.selectAll("*").remove();

      panelGroup.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", sidePanelWidth - 40)
        .attr("height", 320)
        .attr("rx", 6)
        .attr("fill", "#fafafa")
        .attr("stroke", "#ccc");

      const d = feature.properties.data;
      if (!d) return;

      panelGroup.append("text")
        .text(feature.properties.name_long)
        .attr("x", (sidePanelWidth - 10) / 2)
        .attr("text-anchor", "middle")
        .attr("y", -10)
        .attr("font-size", "16px")
        .attr("font-weight", "bold");

      const keys = [
        "Pct Coal consumption",
        "Pct Gas consumption",
        "Pct Oil consumption",
        "Pct Nuclear consumption",
        "Pct Solar consumption",
        "Pct Hydro consumption",
        "Pct Wind consumption",
        "Pct Biofuels consumption",
        "Pct Other renewables",
        "Pct Other"
      ];

      const keyToAbsolute = {
        "Pct Coal consumption": "Coal consumption - TWh",
        "Pct Gas consumption": "Gas consumption - TWh",
        "Pct Oil consumption": "Oil consumption - TWh",
        "Pct Nuclear consumption": "Nuclear consumption - TWh",
        "Pct Solar consumption": "Solar consumption - TWh",
        "Pct Hydro consumption": "Hydro consumption - TWh",
        "Pct Wind consumption": "Wind consumption - TWh",
        "Pct Biofuels consumption": "Biofuels consumption - TWh",
        "Pct Other renewables": "Other renewables (including geothermal and biomass) - TWh",
        "Pct Other": "Other"
      };

      const stackedRow = {};
      keys.forEach(k => stackedRow[k] = getVal(d, k) || 0);

      const stackedRowHover = {};
      keys.forEach(k => stackedRowHover[k] = getVal(d, k) || 0);

      const stack = d3.stack().keys(keys)([stackedRow]);

      const x = d3.scaleBand()
        .domain(["Energy mix"])
        .range([30, sidePanelWidth - 50])
        .padding(0.4);

      const y = d3.scaleLinear()
        .domain([0, 100])
        .nice()
        .range([270, 0]);

      const colorMix = d3.scaleOrdinal()
        .domain(keys)
        .range(d3.schemeTableau10.concat(d3.schemeSet3));

      const g = panelGroup.append("g")
        .attr("transform", "translate(10,20)");

      g.append("g")
        .attr("transform", "translate(70, 0)")
        .call(d3.axisLeft(y).ticks(10));

      const layer = g.selectAll(".layer")
        .data(stack)
        .join("g")
        .attr("fill", d => colorMix(d.key));

      layer.selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", x("Energy mix"))
        .attr("width", x.bandwidth())
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .on("mousemove", (e) => {
          const pctKey = e.currentTarget.parentNode.__data__.key;
          const absKey = keyToAbsolute[pctKey];
      
          const pctVal = getVal(d, pctKey);
          const absVal = getVal(d, absKey);

          tooltip.classed("hidden", false)
            .style("left", e.pageX + 15 + "px")
            .style("top", e.pageY - 30 + "px")
            .html(`<strong>${absKey}</strong><br>${pctVal.toFixed(2)}% (${Math.round(absVal)} GWh)`);
        })
        .on("mouseout", () => tooltip.classed("hidden", true).style("left", "-500px").style("top", "-500px"));
    }

    // ===============================
    // Initialisation du pannel
    // ===============================

    function drawEmptyPanel() {
      panelGroup.selectAll("*").remove();

      const panelHeight = 300;
      const panelWidth = sidePanelWidth - 40;

      // 1. Rectangle de fond
      panelGroup.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", panelWidth)
        .attr("height", panelHeight)
        .attr("rx", 6)
        .attr("fill", "#f2f2f2")
        .attr("stroke", "#ccc");

      // 2. Texte d'instruction
      panelGroup.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", panelHeight / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .attr("fill", "#555")
        .attr("font-style", "italic")
        // IMPORTANT : On définit le texte d'abord, puis on appelle wrap
        .append("tspan")
          .attr("x", panelWidth / 2) 
          .text("Click on a country for more information")
        .append("tspan")
          .attr("x", panelWidth / 2)
          .attr("dy", "1.2em") 
          .text("about the energy mix used")
        .call(wrap, panelWidth - 60); 
    }
})();


