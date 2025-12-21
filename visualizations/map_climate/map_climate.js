(function() {
    const width = 850;
    const height = 600;
    const sideWidth = 400;
    const margin = { top: 60, right: 30, bottom: 60, left: 60 };

    let currentDim = "temperature";
    let geoData, csvData, africaAverages;
    let selectedCountry = null;

    // Définition des unités
    const units = {
        temperature: "°C",
        humidity: "%",
        precipitation: "mm",
        wind_speed: "km/h",
        wetbulb_temperature: "°C"
    };

    const monthNamesShort = ["Janv.", "Févr.", "Mars", "Avril", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

    // Échelles de couleurs
    const colorScales = {
        temperature: d3.scaleSequential(d3.interpolateYlOrRd),
        humidity: d3.scaleSequential(d3.interpolateGnBu),
        precipitation: d3.scaleSequential(d3.interpolateBlues),
        wind_speed: d3.scaleSequential(d3.interpolateGreens),
        // 1) Inversion des couleurs pour wetbulb_temperature
        wetbulb_temperature: d3.scaleSequential(t => d3.interpolateWarm(1 - t))
    };

    const svg = d3.select("#climate-map-holder").append("svg")
        .attr("viewBox", `0 0 ${width + sideWidth} ${height}`);

    const mapGroup = svg.append("g");
    const chartGroup = svg.append("g")
        .attr("transform", `translate(${width + margin.left}, ${margin.top})`);

    const projection = d3.geoMercator().center([18, 5]).scale(400).translate([width / 2, height / 2]);
    const path = d3.geoPath().projection(projection);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip hidden");

    Promise.all([
        d3.csv("../../data/exported/country_month_cleaned.csv"),
        d3.json("../shared/custom.geo.json")
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
        d3.select("#climate-select").on("change", function() {
            currentDim = this.value;
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
        const scale = colorScales[currentDim].domain([d3.min(values), d3.max(values)]);

        mapGroup.selectAll("path")
            .data(geoData.features)
            .join("path")
            .attr("d", path)
            .attr("stroke", "#fff").attr("stroke-width", 0.5)
            .on("mousemove", (e, d) => {
                const val = countryMeans.get(d.properties.name_long);
                tooltip.classed("hidden", false)
                    .style("left", e.pageX + 15 + "px").style("top", e.pageY - 20 + "px")
                    .html(`<strong>${d.properties.name_long}</strong><br>${currentDim}: ${val ? val.toFixed(1) : "N/D"} ${units[currentDim]}`);
            })
            .on("mouseout", () => tooltip.classed("hidden", true))
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

        // 2) Axes avec unités et mois en texte
        chartGroup.append("g")
            .attr("transform", `translate(0,${chartH})`)
            .call(d3.axisBottom(x).ticks(12).tickFormat(d => monthNamesShort[d-1]))
            .selectAll("text")  
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

        chartGroup.append("g")
            .call(d3.axisLeft(y).ticks(5))
            .append("text")
            .attr("x", -10)
            .attr("y", -10)
            .attr("fill", "#000")
            .attr("text-anchor", "end")
            .attr("font-weight", "bold")
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
            .attr("fill", "none").attr("stroke", "#08306b").attr("stroke-width", 3)
            .attr("d", lineGenerator);

        // 3) Ajout des points et hover
        chartGroup.selectAll(".dot")
            .data(countryData.filter(d => isFinite(d.val)))
            .join("circle")
            .attr("class", "dot")
            .attr("cx", d => x(d.month))
            .attr("cy", d => y(d.val))
            .attr("r", 5)
            .attr("fill", "#08306b")
            .on("mousemove", (e, d) => {
                tooltip.classed("hidden", false)
                    .style("left", e.pageX + 15 + "px")
                    .style("top", e.pageY - 20 + "px")
                    .html(`<strong>${monthNamesShort[d.month-1]}</strong><br>${d.val.toFixed(1)} ${units[currentDim]}`);
                d3.select(e.target).attr("r", 8);
            })
            .on("mouseout", (e) => {
                tooltip.classed("hidden", true);
                d3.select(e.target).attr("r", 5);
            });

        chartGroup.append("text").attr("y", -25).attr("font-weight", "bold").text(`${countryName} vs Afrique`);

        const legend = chartGroup.append("g").attr("transform", `translate(0, ${chartH + 60})`);
        legend.append("line").attr("x1", 0).attr("x2", 20).attr("stroke", "#08306b").attr("stroke-width", 3);
        legend.append("text").attr("x", 25).attr("y", 5).attr("font-size", "10px").text(countryName);
        legend.append("line").attr("x1", 120).attr("x2", 140).attr("stroke", "#aaa").attr("stroke-width", 2).attr("stroke-dasharray", "3,3");
        legend.append("text").attr("x", 145).attr("y", 5).attr("font-size", "10px").text("Moyenne Afrique");
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
            .selectAll("text").style("text-anchor", "end").attr("transform", "rotate(-45)");

        chartGroup.append("g").call(d3.axisLeft(y).ticks(5));

        // Ligne Afrique seule
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
            .text(`Moyenne Afrique (${currentDim})`);

        chartGroup.append("text")
            .attr("x", 0).attr("y", 0)
            .attr("font-style", "italic")
            .text("Cliquez sur un pays pour comparer");
    }
})();