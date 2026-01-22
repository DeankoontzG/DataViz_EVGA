(function() {
    /********************************************
     * CONFIGURATION & SCALE
     ********************************************/
    const width = 960;
    const height = 600;
    
    const currentDimension = "WUE_FixedColdWaterDirect(L/KWh)";

    const months = ["January", "Februrary", "Mars", "April", "May", "June", 
                    "July", "August", "September", "October", "November", "December"];

    let currentTimeIndex = 0;
    let timer = null;
    let geoDataGlobal = null;

    const svg = d3.select("#map-holder").append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const g = svg.append("g");
    const legendGroup = svg.append("g")
        .attr("transform", `translate(50, ${height - 80})`);

    const projection = d3.geoMercator()
        .center([17, 17]) 
        .scale(600)       
        .translate([width / 2, height / 2 - 80]);


    const path = d3.geoPath().projection(projection);

    const colorScale = d3.scaleLinear().range(["#ebf3fb", "#08306b"]);
    const colorNoData = "#d1d1d1"; 

    const tooltip = d3.select("#tooltip");

    /********************************************
     * LOADING AND CALCULATION
     ********************************************/
    Promise.all([
        d3.csv("data/exported/country_month_cleaned.csv"),
        d3.json("visualizations/shared/custom.geo.json")
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
        const minVal = d3.min(allMeans) * 0.95;
        const maxVal = d3.max(allMeans);
        colorScale.domain([minVal, maxVal]);

        geoDataGlobal = geoJson;
        
        // Color legend
        drawColorLegend(minVal, maxVal);
        
        initControls();
        updateMap(1);
    });

    function initControls() {
        d3.select("#time-slider").on("input", function() {
            stopAnimation();
            currentTimeIndex = (+this.value) - 1;
            updateMap(+this.value);
        });

        d3.select("#play-button").on("click", function() {
            if (timer) stopAnimation();
            else {
                if (currentTimeIndex >= 11) currentTimeIndex = -1;
                startAnimation();
                d3.select(this).text("Pause");
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
            } else stopAnimation();
        }, 800);
    }

    function stopAnimation() {
        clearInterval(timer);
        timer = null;
        d3.select("#play-button").text("Play");
    }

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
                // On récupère la valeur pour le mois sélectionné
                const v = d.properties.averages[monthNum]; 
                
                tooltip.style("opacity", 1)
                    .style("left", (e.pageX + 15) + "px")
                    .style("top", (e.pageY - 30) + "px")
                    .html(`
                        <strong>${d.properties.name_long}</strong><br>
                        Mois : ${months[monthNum - 1]}<br>
                        WUE : ${v != null ? v.toFixed(2) : "N/D"} L/KWh
                    `);
            })
            .on("mouseout", () => tooltip.style("opacity", 0))
            .transition()
            .duration(500)
            .style("fill", d => {
                const val = d.properties.averages[monthNum];
                return (val != null) ? colorScale(val) : colorNoData;
            });
    }

    function drawColorLegend(minVal, maxVal) {
        legendGroup.selectAll("*").remove();

        const legendWidth = 300;
        const legendHeight = 15;
        const tickCount = 5;

        // Create the gradient
        const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
        defs.selectAll("#seasonal-legend-gradient").remove();
        
        const gradient = defs.append("linearGradient")
            .attr("id", "seasonal-legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%");

        // Color stop
        const stops = d3.range(0, 1.01, 0.01);
        gradient.selectAll("stop")
            .data(stops)
            .join("stop")
            .attr("offset", d => `${d * 100}%`)
            .attr("stop-color", d => colorScale(minVal + d * (maxVal - minVal)));

        // Legend rectangle
        legendGroup.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#seasonal-legend-gradient)")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);

        // Scale
        const legendScale = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(tickCount)
            .tickFormat(d => d.toFixed(2));

        legendGroup.append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(legendAxis)
            .selectAll("text")
            .attr("fill", "#ccc")
            .style("font-size", "30px");

        legendGroup.selectAll(".domain, .tick line")
            .attr("stroke", "#ccc");

        // Labels
        legendGroup.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .attr("fill", "#ccc")
            .style("font-size", "30px")
            .style("font-weight", "500")
            .text("WUE (L/kWh)");
    }
})();
