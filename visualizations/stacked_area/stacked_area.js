const rootStyles = getComputedStyle(document.documentElement);

const themeColors = {
  primary: rootStyles.getPropertyValue('--color-text-primary').trim(),
  secondary: rootStyles.getPropertyValue('--color-text-secondary').trim(),
  muted: rootStyles.getPropertyValue('--color-text-muted').trim(),
  accent: rootStyles.getPropertyValue('--color-accent').trim(),
  coal: rootStyles.getPropertyValue('--color-coal').trim(),
  oil: rootStyles.getPropertyValue('--color-oil').trim(),
  gas: rootStyles.getPropertyValue('--color-gas').trim(),
  lowCarbon: rootStyles.getPropertyValue('--color-low-carbon').trim()
};

const config = {
  margin: { top: 70, right: 200, bottom: 70, left: 150 },
  width: 1100,
  height: 550,
  transitionDuration: 750,
  colors: {
    coal: themeColors.coal,
    oil: themeColors.oil,
    gas: themeColors.gas,
    lowCarbon: themeColors.lowCarbon
  }
};

// Calculate inner dimensions
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
const colorScale = d3
  .scaleOrdinal()
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

// Initialize SVG with responsive behavior
const svg = d3
  .select("#chart")
  .append("svg")
  .attr("width", "100%")
  .attr("height", "100%")
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

// Utility
function countEnergySources(countryDataArray) {
  const totals = { coal: 0, oil: 0, gas: 0, lowCarbon: 0 };

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
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
}

// --- Data Loading ---
Promise.all([
  d3.csv("../../data/exported/country_month_cleaned.csv"),
  d3.csv("../../data/exported/country_year_cleaned.csv"),
  d3.csv("../../data/exported/climate_summary.csv")
]).then(([dataMonth, dataYear, dataClimate]) => {
  // Process monthly data
  dataMonth.forEach(d => {
    d.date = new Date(+d.year, +d.month - 1, 1);
    keys.forEach(k => (d[k] = (+d[k] || 0) / 1000000)); //Correction de l'erreur d'unité des données
    d.climate_region = d.climate_region || "Undefined";
  });
  dataMonth.sort((a, b) => a.date - b.date);
  monthlyData = dataMonth;

  // Process yearly data
  dataYear.forEach(d => {
    d.year = +d.year;
    keys.forEach(k => (d[k] = (+d[k] || 0) / 1000000)); //Correction de l'erreur d'unité des données ici aussi
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
  const regions = Array.from(
    new Set(monthlyData.map(d => d.climate_region))
  ).sort();

  const regionSelect = d3.select("#regionSelect");
  regions.forEach(r => {
    regionSelect.append("option").text(r).attr("value", r);
  });

  function updateCountryOptions(region) {
    const filteredData =
      region === "all"
        ? monthlyData
        : monthlyData.filter(d => d.climate_region === region);

    const countries = Array.from(
      new Set(filteredData.map(d => d.country))
    ).sort();

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
      const optgroupMulti = countrySelect
        .append("optgroup")
        .attr(
          "label",
          `Multi-Source Countries (${multiSourceCountries.length})`
        );
      multiSourceCountries.forEach(c => {
        optgroupMulti.append("option").text(c).attr("value", c);
      });
    }

    if (singleSourceCountries.length > 0) {
      const optgroupSingle = countrySelect
        .append("optgroup")
        .attr(
          "label",
          `Single-Source Countries (${singleSourceCountries.length})`
        );
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

  function updateStatistics(region, multiCount, singleCount) {
    const statsDiv = d3.select("#stats");
    const regionText = region === "all" ? "All Regions" : region;
    const totalCount = multiCount + singleCount;

    statsDiv.html("");

    const items = [
      {
        label: "Region",
        value: regionText
      },
      {
        label: "Total countries",
        value: totalCount
      },
      {
        label: "Multi-source",
        value: multiCount,
        cls: "success"
      },
      {
        label: "Mono-source",
        value: singleCount,
        cls: "warning"
      }
    ];

    items.forEach(item => {
      const box = statsDiv.append("div").attr("class", "stat-item");
      box.append("span").attr("class", "stat-label").text(item.label);
      const val = box
        .append("span")
        .attr("class", "stat-value" + (item.cls ? " " + item.cls : ""));
      val.text(item.value);
    });
  }

  // Initial selection
  updateCountryOptions("all");

  regionSelect.on("change", function () {
    const region = this.value;
    updateCountryOptions(region);
  });

  d3.select("#countrySelect").on("change", function () {
    const country = this.value;
    updateChart(country);
  });

  d3.select("#viewToggle").on("change", function () {
    const country = d3.select("#countrySelect").property("value");
    if (country) {
      updateChart(country);
    }
  });
});

// --- Chart rendering ---
function updateChart(country) {
  const view = d3.select("#viewToggle").property("value");

  const data = view === "monthly"
    ? monthlyData.filter(d => d.country === country)
    : yearlyData.filter(d => d.country === country);

  if (!data.length) {
    svg.selectAll("*").remove();
    return;
  }

  svg.selectAll("*").remove();

  // X scale
  const x = view === "monthly"
    ? d3.scaleTime()
        .domain(d3.extent(data, d => d.date))
        .range([0, width])
    : d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);

  // Y scale
  const maxTotal = d3.max(data, d =>
    keys.reduce((sum, k) => sum + (d[k] || 0), 0)
  );

  const y = d3
    .scaleLinear()
    .domain([0, maxTotal * 1.05])
    .range([height, 0])
    .nice();

  // Stack generator
  const stack = d3
    .stack()
    .keys(keys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const stackedData = stack(data);

  // Area generator
  const area = d3
    .area()
    .x(d => (view === "monthly" ? x(d.data.date) : x(d.data.year)))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]));

  // X Axis
  const xAxis = view === "monthly"
    ? d3.axisBottom(x).ticks(8).tickFormat(d3.timeFormat("%Y-%m"))
    : d3.axisBottom(x).ticks(8).tickFormat(d3.format("d"));

  svg
    .append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0, ${height})`)
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "end")
    .style("fill", themeColors.muted)
    .attr("dx", "-0.6em")
    .attr("dy", "0.15em")
    .attr("transform", "rotate(-35)");

  svg
    .selectAll(".x-axis path, .x-axis line")
    .style("stroke", themeColors.muted);

  // Y Axis
  const yAxis = d3.axisLeft(y).ticks(6);

  svg
    .append("g")
    .attr("class", "axis y-axis")
    .call(yAxis)
    .selectAll("text")
    .style("fill", themeColors.muted);

  svg
    .selectAll(".y-axis path, .y-axis line")
    .style("stroke", themeColors.muted);

  // Y axis label
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", -height / 2)
    .attr("y", -110)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", themeColors.primary)
    .style("font-size", "0.9rem")
    .text("Energy consumption (TWh)");


  // Crosshair vertical line
  const focusLine = svg
    .append("line")
    // .attr("class", "focus-line")
    .attr("y1", 0)
    .attr("y2", height)
    .style("stroke", "white")
    .style("stroke-width", 1)
    .style("stroke-dasharray", "3,3")
    .style("opacity", 0);

  // Grid lines
  const yGrid = d3
    .axisLeft(y)
    .tickSize(-width)
    .tickFormat("");

  svg
    .append("g")
    .attr("class", "grid")
    .call(yGrid);

  // Areas
  const layerGroup = svg.append("g").attr("class", "layers");

  layerGroup
    .selectAll(".layer")
    .data(stackedData)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => colorScale(d.key))
    .attr("d", area)
    .on("mousemove", (event, layer) => {
      const [mx] = d3.pointer(event);
      const dateOrYear = x.invert(mx);

      const bisect =
        view === "monthly"
          ? d3.bisector(d => d.date).left
          : d3.bisector(d => d.year).left;

      const idx =
        view === "monthly"
          ? bisect(data, dateOrYear)
          : bisect(data, dateOrYear);

      const d = data[Math.min(idx, data.length - 1)];

      const total = keys.reduce((sum, k) => sum + (d[k] || 0), 0);

      const xPos = view === "monthly" ? x(d.date) : x(d.year);
      focusLine.attr("x1", xPos).attr("x2", xPos).style("opacity", 1);

      tooltip
        .style("opacity", 1)
        .html(
          `
          <strong>${country}</strong><br/>
          ${
            view === "monthly"
              ? d3.timeFormat("%Y-%m")(d.date)
              : d.year
          }<br/>
          <span style="color:${config.colors.coal}">Coal:</span> ${formatNumber(
            d["Coal consumption - TWh"] || 0
          )} TWh<br/>
          <span style="color:${config.colors.oil}">Oil:</span> ${formatNumber(
            d["Oil consumption - TWh"] || 0
          )} TWh<br/>
          <span style="color:${config.colors.gas}">Gas:</span> ${formatNumber(
            d["Gas consumption - TWh"] || 0
          )} TWh<br/>
          <span style="color:${config.colors.lowCarbon}">Low-carbon:</span> ${formatNumber(
            d["Low carbon - TWh"] || 0
          )} TWh<br/>
          <strong>Total:</strong> ${formatNumber(total)} TWh
        `
        )
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
      focusLine.style("opacity", 0);
    });

  // Legend to the right, not overlapping axes text
  const legend = svg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${width + 25}, 10)`);

  const legendItems = legend
    .selectAll(".legend-item")
    .data(keys)
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 24})`);

  legendItems
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 14)
    .attr("height", 14)
    .attr("rx", 3)
    .attr("fill", d => colorScale(d));

  legendItems
    .append("text")
    .attr("x", 22)
    .attr("y", 11)
    .attr("fill", themeColors.primary)
    .style("font-size", "0.82rem")
    .text(d => labels[d]);

  // Chart title above plot area (optional, if different from page title)
  svg
    .append("text")
    .attr("class", "chart-title")
    .attr("x", width / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("fill", themeColors.primary)
    .style("font-weight", "700")
    .text(country + " energy mix");
}
