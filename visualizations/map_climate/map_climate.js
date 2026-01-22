(function() {
    const width = 850;
    const height = 600;
    const sideWidth = 400;
    const margin = { top: 60, right: 30, bottom: 60, left: 60 };

    let currentDim = "temperature";
    let geoData, csvData, africaAverages;
    let selectedCountry = null;

    // Definition of units
    const units = {
        temperature: "°C",
        humidity: "%",
        precipitation: "mm",
        wind_speed: "km/h",
        wetbulb_temperature: "°C"
    };

    const monthNamesShort = ["Jan.", "Febr.", "Mars", "Apr.", "May", "June", "July.", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

    // Color scales
    const colorScales = {
        temperature: d3.scaleSequential(d3.interpolateYlOrRd),
        humidity: d3.scaleSequential(d3.interpolateGnBu),
        precipitation: d3.scaleSequential(d3.interpolateBlues),
        wind_speed: d3.scaleSequential(d3.interpolateGreens),
        // Color inversion for wetbulb_temperature
        wetbulb_temperature: d3.scaleSequential(t => d3.interpolateWarm(1 - t))
    };

    const svg = d3.select("#climate-map-holder").append("svg")
        .attr("viewBox", `0 0 ${width + sideWidth} ${height}`);

    const mapGroup = svg.append("g");
    const legendGroup = svg.append("g")
        .attr("transform", `translate(50, ${height - 80})`);
    const chartGroup = svg.append("g")
        .attr("transform", `translate(${width + margin.left}, ${margin.top})`);

    const projection = d3.geoMercator().center([18, 5]).scale(400).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    const tooltip = d3.select("#tooltip");

    Promise.all([
        d3.csv("data/exported/country_month_cleaned.csv"),
        d3.json("visualizations/shared/custom.geo.json")
    ]).then(([csv, geo]) => {
        csvData = csv.filter(d => {
            const dateStr = `${d.year}/${d.month.toString().padStart(2, '0')}`;
            return dateStr >= "2022/08" && dateStr <= "2023/07";
        });

        geoData = geo;
        initInteractions();
        updateDisplay();
    });

    function initInteractions() {
        const buttons = d3.selectAll("#climate-toggle button");

        if (buttons.empty()) return;

        buttons.on("click", function() {
            const dim = this.getAttribute("data-dim");
            if (!dim || dim === currentDim) return;

            currentDim = dim;

            buttons.classed("active", false);
            d3.select(this).classed("active", true);

            selectedCountry = null;
            updateDisplay();
        });
    }

    function updateDisplay() {
        const byMonth = d3.group(csvData, d => +d.month);
        africaAverages = Array.from(byMonth, ([month, records]) => ({
            month: month,
            val: d3.mean(records, r => +r[currentDim]?.toString().replace(",", "."))
        })).sort((a, b) => a.month - b.month);

        const countryMeans = d3.rollup(csvData, 
            v => d3.mean(v, d => +d[currentDim]?.toString().replace(",", ".")),
            d => d.country
        );

        const values = Array.from(countryMeans.values()).filter(v => isFinite(v));
        const minVal = d3.min(values);
        const maxVal = d3.max(values);
        const scale = colorScales[currentDim].domain([minVal, maxVal]);

        // Color legend update
        updateColorLegend(scale, minVal, maxVal, currentDim);

        mapGroup.selectAll("path")
            .data(geoData.features)
            .join("path")
            .attr("d", path)
            .attr("stroke", "#fff").attr("stroke-width", 0.5)
            .on("mousemove", (e, d) => {
                const val = countryMeans.get(d.properties.name_long);
                let displayVal = "N/D";
                let displayUnit = units[currentDim];

                if (val !== undefined && isFinite(val)) {
                    // Specific condition for precipitation
                    if (currentDim === "precipitation") {
                        displayVal = (val * 12).toFixed(0); // Multiplied by 12 for a more meaningful annual average than a monthly one
                        displayUnit = "mm/year";           // Change of unit
                    } else {
                        displayVal = val.toFixed(1);
                    }
                }

                tooltip.style("opacity", 1)
                    .style("left", (e.pageX + 15) + "px")
                    .style("top", (e.pageY - 20) + "px")
                    .html(`<strong>${d.properties.name_long}</strong><br>${currentDim.replace("_", " ")}: ${displayVal} ${displayUnit}`);
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0); // We hide through opacity
            })
            .on("click", (e, d) => {
                selectedCountry = d.properties.name_long;
                drawLineChart(selectedCountry);
            })
            .transition().duration(500)
            .attr("fill", d => {
                const val = countryMeans.get(d.properties.name_long);
                return isFinite(val) ? scale(val) : "#eee";
            });

        if (selectedCountry) {
            drawLineChart(selectedCountry);
        } else {
            drawInitialAfricaChart();
    }
    }

    function drawLineChart(countryName) {
        chartGroup.selectAll("*").remove();
        
        const countryData = csvData.filter(d => d.country === countryName)
            .map(d => ({ month: +d.month, val: +d[currentDim]?.toString().replace(",", ".") }))
            .sort((a, b) => a.month - b.month);

        if (countryData.length === 0) return;

        const chartW = sideWidth - margin.left - margin.right;
        const chartH = height / 2;

        const x = d3.scaleLinear().domain([1, 12]).range([0, chartW]);
        const y = d3.scaleLinear()
            .domain([
                d3.min([...countryData, ...africaAverages], d => d.val) * 0.9,
                d3.max([...countryData, ...africaAverages], d => d.val) * 1.1
            ]).nice().range([chartH, 0]);

        // Axes with units and months in text
        chartGroup.append("g")
            .attr("transform", `translate(0,${chartH})`)
            .call(d3.axisBottom(x).ticks(12).tickFormat(d => monthNamesShort[d-1]))
            .selectAll("text")  
            .style("text-anchor", "end")
            .style("font-size", "14px")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        chartGroup.append("g")
            .call(d3.axisLeft(y).ticks(5))
            .selectAll("text")
            .style("font-size", "14px");

        chartGroup.append("text")
            .attr("x", -10)
            .attr("y", -10)
            .attr("fill", "var(--color-text-primary)")
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
            .style("font-size", "14px")
            .text(units[currentDim]);
            

        const lineGenerator = d3.line()
            .x(d => x(d.month))
            .y(d => y(d.val))
            .curve(d3.curveMonotoneX)
            .defined(d => isFinite(d.val));

        chartGroup.append("path")
            .datum(africaAverages)
            .attr("fill", "none").attr("stroke", "#aaa").attr("stroke-width", 2).attr("stroke-dasharray", "4,4")
            .attr("d", lineGenerator);

        chartGroup.append("path")
            .datum(countryData)
            .attr("fill", "none").attr("stroke", "#14086bff").attr("stroke-width", 3)
            .attr("d", lineGenerator);

        // Adding points and hover tooltips
        chartGroup.selectAll(".dot")
            .data(countryData.filter(d => isFinite(d.val)))
            .join("circle")
            .attr("class", "dot")
            .attr("cx", d => x(d.month))
            .attr("cy", d => y(d.val))
            .attr("r", 5)
            .attr("fill", "#14086bff")
            .on("mousemove", (e, d) => {
                tooltip.classed("hidden", false)
                    .style("left", e.pageX + 15 + "px")
                    .style("top", e.pageY - 20 + "px")
                    .html(`<strong>${monthNamesShort[d.month-1]}</strong><br>${d.val.toFixed(1)} ${units[currentDim]}`);
                d3.select(e.target).attr("r", 8);
            })
            .on("mouseout", (e) => {
                tooltip.classed("hidden", true).style("left", "-500px").style("top", "-500px");
                d3.select(e.target).attr("r", 5);
            });

        chartGroup.append("text").attr("y", -25).attr("font-weight", "bold").attr("font-size", "22px").attr("x", 20).text(`${countryName} vs Africa`);

        const legend = chartGroup.append("g").attr("transform", `translate(0, ${chartH + 60})`);
        legend.append("line").attr("x1", 0).attr("x2", 20).attr("y1", 10).attr("y2", 10).attr("stroke", "#14086bff").attr("stroke-width", 3);
        legend.append("text").attr("x", 25).attr("y", 15).attr("font-size", "14px").text(countryName);
        legend.append("line").attr("x1", 0).attr("x2", 20).attr("y1", 35).attr("y2", 35).attr("stroke", "#aaa").attr("stroke-width", 2).attr("stroke-dasharray", "3,3");
        legend.append("text").attr("x", 25).attr("y", 40).attr("font-size", "14px").text("Average Africa");
    }

    function drawInitialAfricaChart() {
        chartGroup.selectAll("*").remove();

        const chartW = sideWidth - margin.left - margin.right;
        const chartH = height / 2;

        const x = d3.scaleLinear().domain([1, 12]).range([0, chartW]);
        const y = d3.scaleLinear()
            .domain([d3.min(africaAverages, d => d.val) * 0.9, d3.max(africaAverages, d => d.val) * 1.1])
            .nice().range([chartH, 0]);

        // Axes
        chartGroup.append("g")
            .attr("transform", `translate(0,${chartH})`)
            .call(d3.axisBottom(x).ticks(12).tickFormat(d => monthNamesShort[d-1]))
            .selectAll("text")  
            .style("text-anchor", "end")
            .style("font-size", "14px")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        chartGroup.append("g")
            .call(d3.axisLeft(y).ticks(5))
            .selectAll("text")
            .style("font-size", "14px");

        chartGroup.append("text")
            .attr("x", -10)
            .attr("y", -10)
            .attr("fill", "var(--color-text-primary)")
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
            .style("font-size", "14px")
            .text(units[currentDim]);

        // Africa line only
        const lineGenerator = d3.line().x(d => x(d.month)).y(d => y(d.val)).curve(d3.curveMonotoneX);

        const yAxis = chartGroup.append("g").call(d3.axisLeft(y).ticks(5));

        yAxis.append("text")
          .attr("x", -10)
          .attr("y", -10)
          .attr("fill", "#333")
          .attr("text-anchor", "end")
          .attr("font-weight", "bold")
          .text(units[currentDim]);

        chartGroup.append("path")
            .datum(africaAverages)
            .attr("fill", "none").attr("stroke", "#aaa").attr("stroke-width", 2).attr("stroke-dasharray", "4,4")
            .attr("d", lineGenerator);

        chartGroup.append("text")
            .attr("y", -25).attr("font-weight", "bold")
            .attr("x", 20)
            .attr("font-size", "22px")
            .text(`Africa mean (${currentDim})`);

        chartGroup.append("text")
            .attr("x", 20).attr("y", 0)
            .attr("font-style", "italic")
            .attr("font-size", "20px")
            .text("Click on a country to compare");
    }

    function updateColorLegend(scale, minVal, maxVal, dimension) {
        legendGroup.selectAll("*").remove();

        const legendWidth = 300;
        const legendHeight = 15;
        const tickCount = 5;

        // Create the gradient
        const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
        defs.selectAll("linearGradient").remove();
        
        const gradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%");

        // Color stops
        const stops = d3.range(0, 1.01, 0.01);
        gradient.selectAll("stop")
            .data(stops)
            .join("stop")
            .attr("offset", d => `${d * 100}%`)
            .attr("stop-color", d => scale(minVal + d * (maxVal - minVal)));

        // Legend rectangle
        legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#legend-gradient)")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);

        // Scale
        const legendScale = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(tickCount)
            .tickFormat(d => d.toFixed(1));

        legendGroup.append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(legendAxis)
            .selectAll("text")
            .attr("fill", "#ccc")
            .style("font-size", "14px");

        legendGroup.selectAll(".domain, .tick line")
            .attr("stroke", "#ccc");

        // Labels
        legendGroup.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -8)
            .attr("text-anchor", "middle")
            .attr("fill", "#ccc")
            .style("font-size", "20px")
            .style("font-weight", "500")
            .text(`${dimension.replace("_", " ")} (${units[dimension]})`);
    }
})();
