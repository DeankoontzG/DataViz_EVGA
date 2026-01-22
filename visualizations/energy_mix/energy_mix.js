const rootStyles = getComputedStyle(document.documentElement);

const themeColors = {
  primary: rootStyles.getPropertyValue("--color-text-primary").trim(),
  secondary: rootStyles.getPropertyValue("--color-text-secondary").trim(),
  muted: rootStyles.getPropertyValue("--color-text-muted").trim(),
  accent: rootStyles.getPropertyValue("--color-accent").trim(),
  coal: rootStyles.getPropertyValue("--color-coal").trim(),
  oil: rootStyles.getPropertyValue("--color-oil").trim(),
  gas: rootStyles.getPropertyValue("--color-gas").trim(),
  lowCarbon: rootStyles.getPropertyValue("--color-low-carbon").trim()
};

const barConfig = {
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

const barInnerWidth =
  barConfig.width - barConfig.margin.left - barConfig.margin.right;
const barInnerHeight =
  barConfig.height - barConfig.margin.top - barConfig.margin.bottom;

// energy keys
const barKeys = [
  "Coal consumption - TWh",
  "Oil consumption - TWh",
  "Gas consumption - TWh",
  "Low carbon - TWh"
];

const barColorScale = d3
  .scaleOrdinal()
  .domain(barKeys)
  .range([
    barConfig.colors.coal,
    barConfig.colors.oil,
    barConfig.colors.gas,
    barConfig.colors.lowCarbon
  ]);

const barLabels = {
  "Coal consumption - TWh": "Coal",
  "Oil consumption - TWh": "Oil",
  "Gas consumption - TWh": "Natural Gas",
  "Low carbon - TWh": "Low-Carbon Sources"
};

const barSvg = d3
  .select("#chart-bar")
  .append("svg")
  .attr("width", barConfig.width)
  .attr("height", barConfig.height)
  .attr("viewBox", `0 0 ${barConfig.width} ${barConfig.height}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .append("g")
  .attr(
    "transform",
    `translate(${barConfig.margin.left},${barConfig.margin.top})`
  );

const barTooltip = d3.select("#tooltip");

let barDataCountries = [];
let currentYear = null;
let currentRegion = "all";
let currentDisplayMode = "top10";
let currentSortMetric = "total";

// format absolute TWh
function barFormatNumber(num) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
}

// --- Data loading ---
d3.csv("data/exported/country_year_cleaned.csv").then(dataYear => {
  dataYear.forEach(d => {
    d.year = +d.year;
    barKeys.forEach(k => (d[k] = (+d[k] || 0) / 1000000));
    d.climate_region = d.climate_region || "Undefined";
  });

  barDataCountries = dataYear;

  const years = Array.from(new Set(barDataCountries.map(d => d.year))).sort(
    (a, b) => a - b
  );
  const defaultYear = 2023;
  currentYear = defaultYear;

  const regions = Array.from(
    new Set(barDataCountries.map(d => d.climate_region))
  ).sort();

  // createYearSelect(years, defaultYear);
  createRegionSelect(regions);
  setupControls();
  updateStackedBar();
});

function createRegionSelect(regions) {
  const container = d3.select("#regionToggle");
  if (container.empty()) return;

  container.html("");

  // "All regions" button
  container
    .append("button")
    .attr("type", "button")
    .attr("class", "pill-toggle-button active")
    .attr("data-region", "all")
    .text("All regions");

  // One button per climate region
  regions.forEach(r => {
    container
      .append("button")
      .attr("type", "button")
      .attr("class", "pill-toggle-button")
      .attr("data-region", r)
      .text(r);
  });

  const buttons = container.selectAll("button");

  buttons.on("click", function () {
    const region = this.getAttribute("data-region");
    if (!region || region === currentRegion) return;

    currentRegion = region;
    buttons.classed("active", false);
    d3.select(this).classed("active", true);
    updateStackedBar();
  });
}

function setupControls() {
  const displayButtons = d3.selectAll("#displayToggle .pill-toggle-button");
  const sortButtons = d3.selectAll("#sortToggle .pill-toggle-button");

  if (!displayButtons.empty()) {
    displayButtons.on("click", function () {
      const mode = this.getAttribute("data-display");
      if (!mode || mode === currentDisplayMode) return;

      currentDisplayMode = mode;
      displayButtons.classed("active", false);
      d3.select(this).classed("active", true);
      updateStackedBar();
    });
  }

  if (!sortButtons.empty()) {
    sortButtons.on("click", function () {
      const metric = this.getAttribute("data-sort");
      if (!metric || metric === currentSortMetric) return;

      currentSortMetric = metric;
      sortButtons.classed("active", false);
      d3.select(this).classed("active", true);
      updateStackedBar();
    });
  }
}

// helper to get percentage-based sort metric
function getPctSortValue(d, sortMetric) {
  if (sortMetric === "coal") {
    return d["Coal consumption - TWh pct"] || 0;
  }
  if (sortMetric === "oil") {
    return d["Oil consumption - TWh pct"] || 0;
  }
  if (sortMetric === "gas") {
    return d["Gas consumption - TWh pct"] || 0;
  }
  if (sortMetric === "lowCarbon") {
    return d["Low carbon - TWh pct"] || 0;
  }
  // default: total absolute energy
  return d._totalAbs || 0;
}

// stats panel
function updateStatistics(region, countriesData) {
  const statsDiv = d3.select("#stats");
  const regionText = region === "all" ? "All regions" : region;

  const totalCount = countriesData.length;

  let multiCount = 0;
  let singleCount = 0;

  countriesData.forEach(d => {
    const threshold = d._totalAbs > 0 ? d._totalAbs * 0.05 : 0; // 5% threshold
    let activeSources = 0;
    if ((d["Coal consumption - TWh"] || 0) > threshold) activeSources++;
    if ((d["Oil consumption - TWh"] || 0) > threshold) activeSources++;
    if ((d["Gas consumption - TWh"] || 0) > threshold) activeSources++;
    if ((d["Low carbon - TWh"] || 0) > threshold) activeSources++;

    if (activeSources >= 2) {
      multiCount++;
    } else {
      singleCount++;
    }
  });

  statsDiv.html("");
}

// --- Chart update ---
function updateStackedBar() {
  if (currentYear == null) return;

  const displayMode = currentDisplayMode || "all";
  const sortMetric = currentSortMetric || "total";

  // filter by year and region
  let data = barDataCountries.filter(d => d.year === currentYear);
  if (currentRegion !== "all") {
    data = data.filter(d => d.climate_region === currentRegion);
  }

  if (!data.length) {
    barSvg.selectAll("*").remove();
    updateStatistics(currentRegion, []);
    return;
  }

  // compute totals and percentages
  let enriched = data.map(d => {
    const total = barKeys.reduce((sum, k) => sum + (d[k] || 0), 0);
    const safeTotal = total > 0 ? total : 1;

    return {
      ...d,
      "Coal consumption - TWh pct": (d["Coal consumption - TWh"] || 0) / safeTotal,
      "Oil consumption - TWh pct": (d["Oil consumption - TWh"] || 0) / safeTotal,
      "Gas consumption - TWh pct": (d["Gas consumption - TWh"] || 0) / safeTotal,
      "Low carbon - TWh pct": (d["Low carbon - TWh"] || 0) / safeTotal,
      _totalAbs: total
    };
  });

  // sort by selected metric (percentage or total)
  enriched.sort((a, b) => getPctSortValue(b, sortMetric) - getPctSortValue(a, sortMetric));

  // limit to Top N
  let maxCountries = Infinity;
  if (displayMode === "top5") maxCountries = 5;
  if (displayMode === "top10") maxCountries = 10;
  let dataLimited = enriched.slice(0, maxCountries);

  // update stats based on filtered region (before Top N)
  updateStatistics(currentRegion, enriched);

  const countries = dataLimited.map(d => d.country);

  const x = d3
    .scaleBand()
    .domain(countries)
    .range([0, barInnerWidth])
    .padding(0.2);

  const y = d3
    .scaleLinear()
    .domain([0, 1])
    .range([barInnerHeight, 0]);

  const pctKeys = [
    "Coal consumption - TWh pct",
    "Oil consumption - TWh pct",
    "Gas consumption - TWh pct",
    "Low carbon - TWh pct"
  ];

  const stack = d3
    .stack()
    .keys(pctKeys)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const stackedData = stack(dataLimited);

  barSvg.selectAll("*").remove();

  // X axis
  const xAxis = d3.axisBottom(x).tickSize(5);

  barSvg
    .append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0, ${barInnerHeight})`)
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "end")
    .style("fill", themeColors.muted)
    .attr("dx", "-0.6em")
    .attr("dy", "0.15em")
    .attr("transform", "rotate(-40)")
    .attr("font-size", "16px");

  barSvg.selectAll(".x-axis path, .x-axis line").style(
    "stroke",
    themeColors.muted
  );

  // Y axis in %
  const yAxis = d3
    .axisLeft(y)
    .ticks(5)
    .tickFormat(d => `${d * 100}%`);

  barSvg
    .append("g")
    .attr("class", "axis y-axis")
    .call(yAxis)
    .selectAll("text")
    .style("fill", themeColors.muted)
    .style("font-size", "14px");

  barSvg.selectAll(".y-axis path, .y-axis line").style(
    "stroke",
    themeColors.muted
  );

  barSvg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", -barInnerHeight / 2)
    .attr("y", -110)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .style("fill", themeColors.primary)
    .style("font-size", "18px")
    .text("Share of energy mix (%)");

  // grid
  const yGrid = d3
    .axisLeft(y)
    .tickSize(-barInnerWidth)
    .tickFormat("");

  barSvg.append("g").attr("class", "grid").call(yGrid);

  // bars
  const countryGroups = barSvg
    .append("g")
    .attr("class", "bars")
    .selectAll(".country-group")
    .data(stackedData)
    .enter()
    .append("g")
    .attr("class", "country-group")
    .attr("fill", (layer, i) => barColorScale(barKeys[i]));

  countryGroups
    .selectAll("rect")
    .data(d => d)
    .enter()
    .append("rect")
    .attr("x", d => x(d.data.country))
    .attr("width", x.bandwidth())
    .attr("y", barInnerHeight)
    .attr("height", 0)
    .on("mousemove", (event, d) => {
      const country = d.data.country;
      const totalAbs = d.data._totalAbs || 0;

      const coalPct = (d.data["Coal consumption - TWh pct"] || 0) * 100;
      const oilPct = (d.data["Oil consumption - TWh pct"] || 0) * 100;
      const gasPct = (d.data["Gas consumption - TWh pct"] || 0) * 100;
      const lowPct = (d.data["Low carbon - TWh pct"] || 0) * 100;

      barTooltip
        .style("opacity", 1)
        .html(
          `
          <strong>${country}</strong><br/>
          Year: ${currentYear}<br/>
          Coal: ${coalPct.toFixed(1)}% (${barFormatNumber(d.data["Coal consumption - TWh"] || 0)} TWh)<br/>
          Oil: ${oilPct.toFixed(1)}% (${barFormatNumber(d.data["Oil consumption - TWh"] || 0)} TWh)<br/>
          Gas: ${gasPct.toFixed(1)}% (${barFormatNumber(d.data["Gas consumption - TWh"] || 0)} TWh)<br/>
          Low-carbon: ${lowPct.toFixed(1)}% (${barFormatNumber(d.data["Low carbon - TWh"] || 0)} TWh)<br/>
          <strong>Total: ${barFormatNumber(totalAbs)} TWh</strong>
        `
        )
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", () => {
      barTooltip.style("opacity", 0);
    })
    .transition()
    .duration(barConfig.transitionDuration)
    .attr("y", d => y(d[1]))
    .attr("height", d => y(d[0]) - y(d[1]));

  // legend
  const legend = barSvg
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${barInnerWidth + 25}, 10)`);

  const legendItems = legend
    .selectAll(".legend-item")
    .data(barKeys)
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
    .attr("fill", d => barColorScale(d));

  legendItems
    .append("text")
    .attr("x", 22)
    .attr("y", 11)
    .attr("fill", themeColors.primary)
    .style("font-size", "16px")
    .text(d => barLabels[d]);

  // title
  barSvg
    .append("text")
    .attr("class", "chart-title")
    .attr("x", barInnerWidth / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .style("fill", themeColors.primary)
    .style("font-weight", "700")
    .style("font-size", "22px")
    .text(
      `Energy mix by country – ${currentYear} (${currentRegion === "all" ? "All regions" : currentRegion}, sorted by ${sortMetric}, ${displayMode === "all" ? "all countries" : displayMode})`
    );
}
