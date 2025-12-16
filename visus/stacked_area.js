const config = {
    margin: { top: 60, right: 200, bottom: 70, left: 80 },
    width: 1100,
    height: 550,
    transitionDuration: 750,
    colors: {
        coal: "#34495e",
        oil: "#e74c3c", 
        gas: "#95a5a6",
        lowCarbon: "#27ae60"
    }
};

// Calculate responsive dimensions
const width = config.width - config.margin.left - config.margin.right;
const height = config.height - config.margin.top - config.margin.bottom;

// Data keys for energy sources
const keys = [
    "Coal consumption - TWh",
    "Oil consumption - TWh", 
    "Gas consumption - TWh",
    "Low carbon - TWh"
];

// Professional color scale
const colorScale = d3.scaleOrdinal()
    .domain(keys)
    .range([
        config.colors.coal,
        config.colors.oil,
        config.colors.gas,
        config.colors.lowCarbon
    ]);

// Clean labels for legend
const labels = {
    "Coal consumption - TWh": "Coal",
    "Oil consumption - TWh": "Oil",
    "Gas consumption - TWh": "Natural Gas",
    "Low carbon - TWh": "Low-Carbon Sources"
};

// Initialize SVG with proper structure
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", config.width)
    .attr("height", config.height)
    .attr("viewBox", `0 0 ${config.width} ${config.height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .append("g")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);

// Tooltip
const tooltip = d3.select("#tooltip");

// Global data storage
let monthlyData = [];
let yearlyData = [];
let climateData = [];
let countrySourceCount = new Map();

// --- Utility Functions ---

function countEnergySources(countryDataArray) {
    const totals = {
        coal: 0,
        oil: 0,
        gas: 0,
        lowCarbon: 0
    };
    
    countryDataArray.forEach(d => {
        totals.coal += d["Coal consumption - TWh"] || 0;
        totals.oil += d["Oil consumption - TWh"] || 0;
        totals.gas += d["Gas consumption - TWh"] || 0;
        totals.lowCarbon += d["Low carbon - TWh"] || 0;
    });
    
    let activeCount = 0;
    if (totals.coal > 1) activeCount++;
    if (totals.oil > 1) activeCount++;
    if (totals.gas > 1) activeCount++;
    if (totals.lowCarbon > 1) activeCount++;
    
    return { count: activeCount, totals };
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0
    }).format(num);
}

// --- Data Loading ---
Promise.all([
    d3.csv("../data/exported/country_month_cleaned.csv"),
    d3.csv("../data/exported/country_year_cleaned.csv"),
    d3.csv("../data/exported/climate_summary.csv")
]).then(([dataMonth, dataYear, dataClimate]) => {
    
    // Process monthly data
    dataMonth.forEach(d => {
        d.date = new Date(+d.year, +d.month - 1, 1);
        keys.forEach(k => d[k] = +d[k] || 0);
        d.climate_region = d.climate_region || "Undefined";
    });
    dataMonth.sort((a, b) => a.date - b.date);
    monthlyData = dataMonth;
    
    // Process yearly data
    dataYear.forEach(d => {
        d.year = +d.year;
        keys.forEach(k => d[k] = +d[k] || 0);
        d.climate_region = d.climate_region || "Undefined";
    });
    yearlyData = dataYear;
    
    climateData = dataClimate;
    
    // Analyze countries
    const countries = Array.from(new Set(monthlyData.map(d => d.country)));
    
    countries.forEach(country => {
        const countryData = monthlyData.filter(d => d.country === country);
        const analysis = countEnergySources(countryData);
        const region = countryData[0].climate_region;
        countrySourceCount.set(country, { 
            count: analysis.count, 
            region: region,
            totals: analysis.totals 
        });
    });
    
    // Setup filters
    const regions = Array.from(new Set(monthlyData.map(d => d.climate_region))).sort();
    
    const regionSelect = d3.select("#regionSelect");
    regions.forEach(r => {
        regionSelect.append("option").text(r).attr("value", r);
    });
    
    // Update country dropdown based on region
    function updateCountryOptions(region) {
        const filteredData = (region === "all") ? monthlyData : monthlyData.filter(d => d.climate_region === region);
        const countries = Array.from(new Set(filteredData.map(d => d.country))).sort();
        
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
        
        if (multiSourceCountries.length > 0) {
            const optgroupMulti = countrySelect.append("optgroup")
                .attr("label", `Multi-Source Countries (${multiSourceCountries.length})`);
            multiSourceCountries.forEach(c => {
                optgroupMulti.append("option").text(c).attr("value", c);
            });
        }
        
        if (singleSourceCountries.length > 0) {
            const optgroupSingle = countrySelect.append("optgroup")
                .attr("label", `Single-Source Countries (${singleSourceCountries.length})`);
            singleSourceCountries.forEach(c => {
                optgroupSingle.append("option").text(c).attr("value", c);
            });
        }
        
        updateStatistics(region, multiSourceCountries.length, singleSourceCountries.length);
        
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
    
    // Update statistics display
    function updateStatistics(region, multiCount, singleCount) {
        const statsDiv = d3.select("#stats");
        const regionText = region === "all" ? "All Regions" : region;
        const totalCount = multiCount + singleCount;
        
        statsDiv.html(`
            <div class="stat-item">
                <span class="stat-label">Region</span>
                <span class="stat-value">${regionText}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total Countries</span>
                <span class="stat-value">${totalCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Multi-Source</span>
                <span class="stat-value success">${multiCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Single-Source</span>
                <span class="stat-value warning">${singleCount}</span>
            </div>
        `);
    }
    
    // Initialize
    updateCountryOptions("all");
    
    // Event listeners
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
    
    // --- Main Chart Update Function ---
    function updateChart(selectedCountry) {
        const viewType = d3.select("#viewToggle").property("value");
        
        let countryData;
        let isYearlyView = false;
        
        if (viewType === "yearly") {
            countryData = yearlyData.filter(d => d.country === selectedCountry);
            isYearlyView = true;
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
                .style("font-size", "14px")
                .style("fill", "#7f8c8d")
                .text("No data available for this country");
            return;
        }
        
        // Update chart title
        const viewLabel = isYearlyView ? "Yearly Trends" : "Monthly Details";
        d3.select("#chart-main-title").text(`${selectedCountry} - ${viewLabel}`);
        
        // Scales
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
        
        // Stack generator
        const stackedData = d3.stack()
            .keys(keys)
            (countryData);
        
        const area = d3.area()
            .x(d => x(d.data.date))
            .y0(d => y(d[0]))
            .y1(d => y(d[1]))
            .curve(d3.curveMonotoneX);
        
        // Clear previous content
        svg.selectAll("*").remove();
        
        // Add grid
        svg.append("g")
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat("")
            );
        
        // X Axis
        const xAxisFormat = isYearlyView ? d3.timeFormat("%Y") : d3.timeFormat("%b %Y");
        const xAxis = d3.axisBottom(x)
            .ticks(isYearlyView ? d3.timeYear.every(1) : 8)
            .tickFormat(xAxisFormat);
            
        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .attr("class", "axis")
            .call(xAxis)
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end");
        
        // Y Axis
        svg.append("g")
            .attr("class", "axis")
            .call(d3.axisLeft(y).ticks(8));
        
        // Y Axis Label
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -60)
            .attr("x", -height / 2)
            .style("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .style("fill", "#2c3e50")
            .text("Energy Consumption (TWh)");
        
        // X Axis Label
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 60)
            .style("text-anchor", "middle")
            .style("font-size", "13px")
            .style("font-weight", "600")
            .style("fill", "#2c3e50")
            .text("Time Period");
        
        // Draw areas with transition
        const layers = svg.selectAll(".layer")
            .data(stackedData)
            .join("path")
            .attr("class", "layer")
            .style("fill", d => colorScale(d.key))
            .style("opacity", 0)
            .attr("d", area);
        
        layers.transition()
            .duration(config.transitionDuration)
            .style("opacity", 0.85);
        
        layers
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 1)
                    .style("stroke", "#1a1a2e")
                    .style("stroke-width", "2px");
            })
            .on("mousemove", function(event, d) {
            const label = labels[d.key];

            // Find closest data point
            const mouseX = d3.pointer(event, this)[0];
            const xDate = x.invert(mouseX);

            const bisect = d3.bisector(d => d.data.date).left;
            const index = bisect(d, xDate);
            const dataPoint = d[index];

            if (dataPoint) {
                const value = dataPoint[1] - dataPoint[0];

                // Récupérer la bounding box du conteneur du chart
                const container = document.getElementById("chart-container");
                const rect = container.getBoundingClientRect();

                // Position du curseur relative au conteneur
                const relX = event.clientX - rect.left;
                const relY = event.clientY - rect.top;

                tooltip
                .style("opacity", 1)
                .html(`
                    <div style="font-weight: 600; margin-bottom: 4px;">${label}</div>
                    <div style="font-size: 0.9em;">${formatNumber(value)} TWh</div>
                `)
                .style("left", (relX + 15) + "px")
                .style("top", (relY - 28) + "px");
            }
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 0.85)
                    .style("stroke", "none");
                tooltip.style("opacity", 0);
            });
        
        // Legend
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width + 30}, 0)`);
        
        const legendItems = legend.selectAll(".legend-item")
            .data(keys.slice().reverse())
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 30})`);
        
        legendItems.append("rect")
            .attr("width", 18)
            .attr("height", 18)
            .attr("rx", 3)
            .style("fill", d => colorScale(d));
        
        legendItems.append("text")
            .attr("x", 26)
            .attr("y", 9)
            .attr("dy", "0.35em")
            .text(d => labels[d])
            .style("font-size", "13px")
            .style("font-weight", "500")
            .style("fill", "#2c3e50");
        
        // Add summary statistics
        const countryInfo = countrySourceCount.get(selectedCountry);
        if (countryInfo) {
            const summaryY = keys.length * 30 + 40;
            
            legend.append("text")
                .attr("y", summaryY)
                .style("font-size", "12px")
                .style("font-weight", "600")
                .style("fill", "#7f8c8d")
                .text("Total Consumption:");
            
            const totalConsumption = Object.values(countryInfo.totals).reduce((a, b) => a + b, 0);
            
            legend.append("text")
                .attr("y", summaryY + 20)
                .style("font-size", "16px")
                .style("font-weight", "700")
                .style("fill", "#2c3e50")
                .text(`${formatNumber(totalConsumption)} TWh`);
        }
    }
    
}).catch(error => {
    console.error("Error loading data:", error);
    d3.select("#chart")
        .append("div")
        .style("padding", "40px")
        .style("text-align", "center")
        .style("color", "#e74c3c")
        .html(`
            <h3>Data Loading Error</h3>
            <p>Please verify that CSV files are in the correct location:</p>
            <code>../data/exported/</code>
        `);
});