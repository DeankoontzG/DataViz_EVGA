(function() {
    const margin = {top: 50, right: 30, bottom: 120, left: 100}, // Augmentation du bottom pour la note
          width = 960 - margin.left - margin.right,
          height = 550 - margin.top - margin.bottom;

    const PO_VOLUME = 2500000; // Volume en L de piscine olympique

    const svg = d3.select("#water-volume-bar-holder")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("#tooltip");

    // Échelles
    const x = d3.scaleBand().range([0, width]).padding(0.3);
    const y = d3.scaleLinear().range([height, 0]);
    const color = d3.scaleOrdinal()
        .domain(["partIndirect", "partCold", "partApproach"])
        .range(["#4e79a7", "#76b7b2", "#e15759"]);

    const labels = {
        partIndirect: "Indirect WUE (Source)",
        partCold: "Direct WUE (Cold Water)",
        partApproach: "Surplus Approach"
    };

    d3.csv("../../data/exported/country_year_cleaned.csv").then(data => {
        const rawData2023 = data.filter(d => d.year === "2023");

        // Calcul des volumes adaptés en piscines olympiques
        const processedData = rawData2023.map(d => {
            const energyTWh = parseFloat(d["Total energy - TWh"]?.replace(",", ".")) || 0;
            const energyKWh = energyTWh * 1e3; // conversion en kWh
            
            const wueInd = parseFloat(d["WUE_Indirect(L/KWh)"]?.replace(",", ".")) || 0;
            const wueCold = parseFloat(d["WUE_FixedColdWaterDirect(L/KWh)"]?.replace(",", ".")) || 0;
            const wueAppr = parseFloat(d["WUE_FixedApproachDirect(L/KWh)"]?.replace(",", ".")) || 0;

            const popEquiv = ((wueInd + wueAppr) * energyKWh * 45) / PO_VOLUME

            // Volume total en Litres puis division par PO_VOLUME
            return {
                country: d.country,
                partIndirect: (wueInd * energyKWh) / PO_VOLUME,
                partCold: (wueCold * energyKWh) / PO_VOLUME,
                partApproach: ((wueAppr - wueCold) * energyKWh) / PO_VOLUME,
                total: ((wueInd + wueAppr) * energyKWh) / PO_VOLUME,
                popEquiv : Math.round(popEquiv / 100) * 100
            };
        })
        .filter(d => d.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

        // MAJ des échelles
        x.domain(processedData.map(d => d.country));
        y.domain([0, d3.max(processedData, d => d.total)]).nice();

        // Axes
        const xAxis = svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));
            
        xAxis.selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .style("font-size", "14px")
            .style("fill", "var(--color-text-secondary)");

        // Axe Y en Nombre de Piscines
        svg.append("g")
            .call(d3.axisLeft(y).tickFormat(d => d3.format(",")(d)))
            .call(g => g.selectAll("text").style("fill", "var(--color-text-secondary)").style("font-size", "14px"))
            .append("text")
            .attr("x", -height/2)
            .attr("y", -70)
            .attr("fill", "var(--color-text-primary)")
            .attr("transform", "rotate(-90)")
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .attr("font-size", "16px")
            .text("Equivalent Olympic Swimming Pools / year");

        // Dessin des barres
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
                const valPools = d[1] - d[0];
                
                tooltip.style("opacity", 1)
                    .style("left", e.pageX + 15 + "px")
                    .style("top", e.pageY - 20 + "px")
                    .html(`
                        <strong>${d.data.country}</strong><br>
                        ${labels[layerKey]}<br>
                        <strong>${Math.round(valPools).toLocaleString()} pools</strong><br>
                        <small>(Total: ${Math.round(d.data.total).toLocaleString()} pools)</small>
                    `);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);   // Utilisation de l'opacité pour masquer
            });

        // Légende
        const legend = svg.append("g")
            .attr("transform", `translate(${width - 250}, -20)`);

        ["partIndirect", "partCold", "partApproach"].forEach((key, i) => {
            const lg = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
            lg.append("rect").attr("width", 15).attr("height", 15).attr("fill", color(key));
            lg.append("text").attr("x", 22).attr("y", 12)
                .style("font-size", "16px")
                .style("fill", "var(--color-text-secondary)")
                .text(labels[key]);
        });

        // Labels équivalent de populatioon (au dessus)
        const labelsPop = svg.selectAll(".pop-label-group")
            .data(processedData)
            .enter()
            .append("g")
            .attr("class", "pop-label-group");

        labelsPop.append("text")
            .attr("x", d => x(d.country) + x.bandwidth() / 2)
            .attr("y", d => y(d.total) - 18) 
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("fill", "var(--color-text-primary)")
            .text(d => `🏠 ≃ ${d3.format(".2s")(d.popEquiv).replace('G', 'B')}`);

        // Explications en dessous de l'axe des x
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 100)
            .attr("text-anchor", "middle")
            .style("font-size", "var(--font-size-sm)")
            .style("fill", "var(--color-text-muted)")
            .style("font-style", "italic")
            .style("font-size", "18px")
            .text("1 Olympic Swimming Pool ≈ 2,500,000 Liters (50m x 25m x 2m)");
    });
})();