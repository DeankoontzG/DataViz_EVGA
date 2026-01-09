(function() {
    const holder = d3.select("#energy-volume-bar-holder");
    holder.selectAll("*").remove();

    // 1. On récupère la largeur réelle de la div parente
    const containerWidth = holder.node().getBoundingClientRect().width || 960;
    const containerHeight = 600; // Tu peux l'augmenter si besoin

    const margin = { top: 80, right: 30, bottom: 120, left: 80 },
          width = containerWidth - margin.left - margin.right,
          height = containerHeight - margin.top - margin.bottom;

    const TWH_PER_MILLION = 1.6;

    const cityMapping = {
        "Egypt": "New York City",
        "South Africa": "Hong Kong",
        "Algeria": "Berlin",
        "Morocco": "Munich",
        "Nigeria": "Nice",
        "Zambia": "Bordeaux",
        "Ghana": "Lille",
        "Mozambique": "Rennes",
        "default": "City"
    };

    // 2. On utilise viewBox pour que le graph s'étire proprement
    const svg = holder.append("svg")
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("#tooltip");

    const x = d3.scaleBand().range([0, width]).padding(0.4);
    const y = d3.scaleLinear().range([height, 0]);

    d3.csv("data/exported/country_year_cleaned.csv").then(data => {
        const rawData2023 = data.filter(d => d.year === "2023");

        const processedData = rawData2023.map(d => {
            // Note: J'ai gardé ta division par 1 000 000 pour corriger l'unité de ton dataset
            const energyTWh = (parseFloat(d["Total energy - TWh"]?.replace(",", ".")) || 0) / 1000000;
            const popEquiv = (energyTWh / TWH_PER_MILLION) * 1000000;
            
            return {
                country: d.country,
                energyTWh: energyTWh,
                popEquiv: Math.round(popEquiv / 100) * 100,
                city: cityMapping[d.country] || cityMapping["default"]
            };
        })
        .filter(d => d.energyTWh > 0)
        .sort((a, b) => b.energyTWh - a.energyTWh)
        .slice(0, 8); 

        x.domain(processedData.map(d => d.country));
        y.domain([0, d3.max(processedData, d => d.energyTWh)]).nice();

        // Axe X
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-35)")
            .style("text-anchor", "end")
            .style("font-size", "14px")
            .style("fill", "var(--color-text-secondary)");

        // Axe Y
        const yAxis = svg.append("g")
            .call(d3.axisLeft(y).ticks(6).tickSize(-width));
            
        yAxis.selectAll("text").style("fill", "var(--color-text-secondary)").style("font-size", "14px");
        yAxis.selectAll(".domain").remove();
        yAxis.selectAll(".tick line").style("stroke", "#ffffff").style("stroke-opacity", 0.6).style("stroke-dasharray", "2,2")

        // Label Y
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 25)
            .attr("x", -(height / 2))
            .attr("text-anchor", "middle")
            .attr("font-size", "16px")
            .attr("font-weight", "bold")
            .style("fill", "var(--color-text-primary)")
            .text("Energy Consumption (TWh/year)");

        // Barres
        const bars = svg.selectAll(".bar-group")
            .data(processedData)
            .enter()
            .append("g");

        bars.append("rect")
            .attr("x", d => x(d.country))
            .attr("y", d => y(d.energyTWh))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d.energyTWh))
            .attr("fill", "#4e79a7")
            .attr("rx", 4) 
            .on("mousemove", function(e, d) {
                tooltip.style("opacity", 1)
                    .style("left", e.pageX + 15 + "px")
                    .style("top", e.pageY - 20 + "px")
                    .html(`
                        <div style="font-size: 13px; padding: 5px;">
                            <strong>${d.country}</strong><br>
                            ⚡ ${d.energyTWh.toFixed(2)} TWh/year<br>
                            <hr style="margin: 5px 0; border-top: 1px solid #ddd;">
                            🏠 ≃ ${d3.format(",")(d.popEquiv)} people<br>
                            🏙️ Like <strong>${d.city}</strong>
                        </div>
                    `);
            })
            .on("mouseout", () => tooltip.style("opacity", 0));

        // Labels au-dessus

        bars.append("text")
            .attr("x", d => x(d.country) + x.bandwidth() / 2)
            .attr("y", d => y(d.energyTWh) - 28)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .style("fill", "var(--color-text-primary)")
            .text(d => `🏠 ≃ ${d3.format(".2s")(d.popEquiv)}`);

        bars.append("text")
            .attr("x", d => x(d.country) + x.bandwidth() / 2)
            .attr("y", d => y(d.energyTWh) - 12)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("fill", "#d5d5d5ff")
            .text(d => d.city);
    });
})();