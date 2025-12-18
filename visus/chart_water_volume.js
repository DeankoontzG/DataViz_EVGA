(function() {
    const margin = {top: 50, right: 30, bottom: 100, left: 100},
          width = 960 - margin.left - margin.right,
          height = 550 - margin.top - margin.bottom;

    const svg = d3.select("#water-volume-bar-holder")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip hidden");

    // Échelles
    const x = d3.scaleBand().range([0, width]).padding(0.3);
    const y = d3.scaleLinear().range([height, 0]);
    const color = d3.scaleOrdinal()
        .domain(["partIndirect", "partCold", "partApproach"])
        .range(["#4e79a7", "#76b7b2", "#e15759"]);

    const labels = {
        partIndirect: "WUE Indirect (Source)",
        partCold: "WUE Direct (Cold Water)",
        partApproach: "Surplus Approach"
    };

    d3.csv("../data/exported/country_year_cleaned.csv").then(data => {
        const rawData2023 = data.filter(d => d.year === "2023");

        // 1. CALCUL DES VOLUMES EN LITRES
        const processedData = rawData2023.map(d => {
            const energyTWh = parseFloat(d["Total energy - TWh"]?.replace(",", ".")) || 0;
            const energyKWh = energyTWh * 1e3; // Conversion TWh -> kWh
            
            const wueInd = parseFloat(d["WUE_Indirect(L/KWh)"]?.replace(",", ".")) || 0;
            const wueCold = parseFloat(d["WUE_FixedColdWaterDirect(L/KWh)"]?.replace(",", ".")) || 0;
            const wueAppr = parseFloat(d["WUE_FixedApproachDirect(L/KWh)"]?.replace(",", ".")) || 0;

            return {
                country: d.country,
                energyTWh: energyTWh,
                // Volume en Litres
                partIndirect: wueInd * energyKWh,
                partCold: wueCold * energyKWh,
                partApproach: (wueAppr - wueCold) * energyKWh,
                total: (wueInd + wueAppr) * energyKWh
            };
        })
        .filter(d => d.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

        // 2. MISE À JOUR DES ÉCHELLES
        x.domain(processedData.map(d => d.country));
        y.domain([0, d3.max(processedData, d => d.total)]).nice();

        // 3. AXES
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");

        // Axe Y en Milliards de Litres (10^9)
        svg.append("g")
            .call(d3.axisLeft(y).tickFormat(d => (d / 1e9).toFixed(0) + " GL"))
            .append("text")
            .attr("x", -height/2)
            .attr("y", -70)
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .text("Volume d'eau total (Milliards de Litres - GL)");

        // 4. DESSIN DES BARRES (STACKED)
        const stack = d3.stack().keys(["partIndirect", "partCold", "partApproach"])(processedData);

        const layers = svg.selectAll(".layer")
            .data(stack)
            .join("g")
            .attr("class", "layer")
            .attr("fill", d => color(d.key));

        layers.selectAll("rect")
            .data(d => d)
            .join("rect")
            .attr("x", d => x(d.data.country))
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", x.bandwidth())
            .on("mousemove", function(e, d) {
                const layerKey = d3.select(this.parentNode).datum().key;
                const valLitres = d[1] - d[0];
                
                tooltip.classed("hidden", false)
                    .style("left", e.pageX + 15 + "px")
                    .style("top", e.pageY - 20 + "px")
                    .html(`
                        <strong>${d.data.country}</strong><br>
                        ${labels[layerKey]}<br>
                        <strong>${(valLitres / 1e6).toLocaleString(undefined, {maximumFractionDigits: 0})} millions de Litres</strong><br>
                        <small>(Total : ${(d.data.total / 1e9).toFixed(1)} GL)</small>
                    `);
            })
            .on("mouseout", () => tooltip.classed("hidden", true));

        // 5. LÉGENDE
        const legend = svg.append("g")
            .attr("transform", `translate(${width - 250}, -20)`);

        ["partIndirect", "partCold", "partApproach"].forEach((key, i) => {
            const lg = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
            lg.append("rect").attr("width", 15).attr("height", 15).attr("fill", color(key));
            lg.append("text").attr("x", 22).attr("y", 12).style("font-size", "12px").text(labels[key]);
        });
    });
})();