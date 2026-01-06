(function() {
    const margin = { top: 50, right: 30, bottom: 120, left: 100 },
          width = 960 - margin.left - margin.right,
          height = 550 - margin.top - margin.bottom;

    const svg = d3.select("#energy-volume-bar-holder")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("#tooltip");

    const x = d3.scaleBand().range([0, width]).padding(0.3);
    const y = d3.scaleLinear().range([height, 0]);

    d3.csv("../../data/exported/country_year_cleaned.csv").then(data => {
        const rawData2023 = data.filter(d => d.year === "2023");

        const processedData = rawData2023.map(d => {
            const energyTWh = parseFloat(d["Total energy - TWh"]?.replace(",", ".")) || 0;
            return {
                country: d.country,
                energyTWh
            };
        })
        .filter(d => d.energyTWh > 0)
        .sort((a, b) => b.energyTWh - a.energyTWh)
        .slice(0, 10);

        x.domain(processedData.map(d => d.country));
        y.domain([0, d3.max(processedData, d => d.energyTWh)]).nice();

        const xAxis = svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        xAxis.selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
            .style("fill", "var(--color-text-secondary)");

        svg.append("g")
            .call(d3.axisLeft(y).tickFormat(d => d3.format(",")(d)))
            .call(g => g.selectAll("text").style("fill", "var(--color-text-secondary)"))
            .append("text")
            .attr("x", -height / 2)
            .attr("y", -70)
            .attr("fill", "var(--color-text-primary)")
            .attr("transform", "rotate(-90)")
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .text("Total energy consumption (TWh)");

        svg.selectAll(".bar")
            .data(processedData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.country))
            .attr("y", d => y(d.energyTWh))
            .attr("width", x.bandwidth())
            .attr("height", d => height - y(d.energyTWh))
            .attr("fill", "#4e79a7")
            .on("mousemove", function(e, d) {
                tooltip.style("opacity", 1)
                    .style("left", e.pageX + 15 + "px")
                    .style("top", e.pageY - 20 + "px")
                    .html(`
                        <strong>${d.country}</strong><br>
                        Total energy consumption:<br>
                        <strong>${d.energyTWh.toLocaleString(undefined, { maximumFractionDigits: 1 })} TWh</strong>
                    `);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .style("fill", "var(--color-text-primary)")
            .text("Total energy consumption – Top 10 countries (2023)");
    });
})();