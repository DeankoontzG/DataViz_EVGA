function parseFloatValue(value) {
    if (!value || value === "") return NaN;
    return +String(value).replace(",", ".");
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
        });
    });
}

function initVisualization() {
    'use strict';

    if (typeof d3 === 'undefined') {
        console.error('D3.js not loaded!');
        return;
    }

    const config = {
        width: 960,
        height: 750,
        wueImpactRate: 0.04,
        transitionDuration: 200
    };

    let currentTemperature = 0;
    let colorScale = null;
    let totalCurrentWUE = 0;

    /* Projection Setup */
    const projection = d3.geoMercator()
        .center([15, 10])
        .scale(550)
        .translate([config.width / 2, config.height / 2 - 80]);

    const path = d3.geoPath().projection(projection);

    /* DOM Elements */
    const canvas = d3.select('#canvas')
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('margin', '16px 0');

    const rightSection = canvas.append('div')
        .style('max-width', '640px')
        .style('width', '100%');

    const svgRight = rightSection.append('svg')
        .attr('viewBox', `0 0 ${config.width} ${config.height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto');

    const mapGroupRight = svgRight.append('g');
    const legendGroup = svgRight.append('g');

    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip predictive-tooltip')
        .style('opacity', 0);

    function calculateProjectedWUE(currentWUE, tempIncrease) {
        return currentWUE * Math.pow(1 + config.wueImpactRate, tempIncrease);
    }

    function formatWUE(value) {
        return value != null && !isNaN(value) ? value.toFixed(2) : 'N/A';
    }

    function calculatePercentChange(current, projected) {
        if (!current || current === 0) return 0;
        return ((projected - current) / current * 100).toFixed(1);
    }

    function showTooltipRight(event, d) {
        const data = d.properties.data;

        if (!data || !data.totalWUE) {
            tooltip.transition().duration(100).style('opacity', 0.95);
            tooltip.html(`
                <strong>${d.properties.name_long}</strong><br>
                <span class="tooltip-climate">Data not available</span>
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 30) + 'px');
            return;
        }

        const projected = calculateProjectedWUE(data.totalWUE, currentTemperature);
        const change = projected - data.totalWUE;
        const percentChange = calculatePercentChange(data.totalWUE, projected);

        tooltip.transition().duration(100).style('opacity', 0.95);
        tooltip.html(`
            <strong>${d.properties.name_long}</strong><br>
            <span><strong>Current:</strong> ${formatWUE(data.totalWUE)} L/kWh</span><br>
            <span><strong>Projected:</strong> ${formatWUE(projected)} L/kWh</span><br>
            <span class="${change > 0 ? 'tooltip-leakage' : 'tooltip-wue'}">
                <strong>Change:</strong> +${percentChange}% (+${formatWUE(change)} L/kWh)
            </span><br>
            <span class="tooltip-total tooltip-detail">
                Temperature: +${currentTemperature.toFixed(1)}°C
            </span>
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 30) + 'px');
    }

    function hideTooltip() {
        tooltip.transition().duration(200).style('opacity', 0);
    }

    /* Map Update Function */
    function updateProjectedMap(tempIncrease) {
        currentTemperature = tempIncrease;

        d3.select('#temp-value').text(`+${tempIncrease.toFixed(1)}°C`);

        const totalProjectedWUE = calculateProjectedWUE(totalCurrentWUE, tempIncrease);
        const totalIncrease = totalProjectedWUE - totalCurrentWUE;
        const percentIncrease = totalCurrentWUE > 0
            ? ((totalIncrease / totalCurrentWUE) * 100).toFixed(1)
            : 0;

        d3.select('#total-wue-increase').text(
            `+${percentIncrease}% (${totalIncrease.toFixed(2)} L/kWh)`
        );

        mapGroupRight.selectAll('path.country')
            .interrupt()
            .transition()
            .duration(config.transitionDuration)
            .attr('fill', d => {
                const wue = d.properties.data?.totalWUE;
                if (!wue || isNaN(wue) || wue <= 0) return '#ccc';

                const projected = calculateProjectedWUE(wue, tempIncrease);
                return colorScale(projected);
            });
    }

    Promise.all([
        d3.csv('data/exported/country_year_cleaned.csv'),
        d3.json('visualizations/shared/custom.geo.json')
    ]).then(([csvData, geoData]) => {

        const processedData = csvData.map(row => {
            const wueIndirect = parseFloatValue(row['WUE_Indirect(L/KWh)']);
            const wueDirect = parseFloatValue(row['WUE_FixedApproachDirect(L/KWh)']);

            let totalWUE = null;
            if (!isNaN(wueIndirect) && !isNaN(wueDirect) && wueIndirect > 0 && wueDirect > 0) {
                totalWUE = wueIndirect + wueDirect;
            }

            return {
                country: row.country,
                totalWUE: totalWUE
            };
        });

        const dataByCountry = new Map();
        const grouped = d3.group(processedData, d => d.country);

        grouped.forEach((values, country) => {
            const validTotal = values.filter(v => !isNaN(v.totalWUE) && v.totalWUE > 0).map(v => v.totalWUE);

            const avgTotal = validTotal.length > 0 ? d3.mean(validTotal) : NaN;

            dataByCountry.set(country, {
                country: country,
                totalWUE: avgTotal
            });
        });

        geoData.features.forEach(feature => {
            const countryName = feature.properties.name_long;
            const countryData = dataByCountry.get(countryName);

            if (countryData && !isNaN(countryData.totalWUE)) {
                feature.properties.data = countryData;
            } else {
                feature.properties.data = null;
            }
        });

        const validWUE = geoData.features
            .map(f => f.properties.data?.totalWUE)
            .filter(v => v != null && !isNaN(v) && v > 0);

        if (validWUE.length === 0) {
            console.error('No valid WUE values found!');
            return;
        }

        const minWUE = d3.min(validWUE);
        const maxWUE = d3.max(validWUE);
        const midWUE = d3.median(validWUE);

        colorScale = d3.scaleLinear()
            .domain([minWUE, midWUE, maxWUE])
            .range(['#2ECC71', '#F39C12', '#E74C3C'])
            .clamp(true);

        totalCurrentWUE = validWUE.reduce((sum, wue) => sum + wue, 0);

        drawMaps(geoData);
        drawColorLegend(minWUE, maxWUE);
        setupSlider();

    }).catch(error => {
        console.error('Error loading data:', error);
    });

    function drawMaps(geoData) {
        mapGroupRight.selectAll('path')
            .data(geoData.features)
            .join('path')
            .attr('d', path)
            .attr('class', 'country')
            .attr('fill', d => {
                const wue = d.properties.data?.totalWUE;
                if (!wue || isNaN(wue) || wue <= 0) return '#ccc';
                return colorScale(wue);
            })
            .attr('stroke', '#ffffff')
            .attr('stroke-width', '1px')
            .on('mousemove', (event, d) => showTooltipRight(event, d))
            .on('mouseout', hideTooltip);
    }

    function drawColorLegend(minVal, maxVal) {
        legendGroup.selectAll('*').remove();

        const legendWidth = 300;
        const legendHeight = 15;
        const tickCount = 5;

        const defs = svgRight.select('defs').empty() ? svgRight.append('defs') : svgRight.select('defs');
        defs.selectAll('#predictive-legend-gradient').remove();

        const gradient = defs.append('linearGradient')
            .attr('id', 'predictive-legend-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%');

        const stops = d3.range(0, 1.01, 0.01);
        gradient.selectAll('stop')
            .data(stops)
            .join('stop')
            .attr('offset', d => `${d * 100}%`)
            .attr('stop-color', d => colorScale(minVal + d * (maxVal - minVal)));

        legendGroup
            .attr('transform', `translate(50, ${config.height - 80})`);

        legendGroup.append('rect')
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#predictive-legend-gradient)')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

        const legendScale = d3.scaleLinear()
            .domain([minVal, maxVal])
            .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(tickCount)
            .tickFormat(d => d.toFixed(2));

        legendGroup.append('g')
            .attr('transform', `translate(0, ${legendHeight})`)
            .call(legendAxis)
            .selectAll('text')
            .attr('fill', '#ccc')
            .style('font-size', '14px');

        legendGroup.selectAll('.domain, .tick line')
            .attr('stroke', '#ccc');

        legendGroup.append('text')
            .attr('x', legendWidth / 2)
            .attr('y', -8)
            .attr('text-anchor', 'middle')
            .attr('fill', '#ccc')
            .style('font-size', '20px')
            .style('font-weight', '500')
            .text('WUE (L/kWh)');
    }

    function setupSlider() {
        const slider = d3.select('#temp-slider');

        if (slider.empty()) {
            console.warn('Temperature slider not found in DOM');
            return;
        }

        slider.on('input', function() {
            const tempIncrease = +this.value;
            updateProjectedMap(tempIncrease);
        });
    }
}

function initWaterfallChart() {
    'use strict';

    if (typeof d3 === 'undefined') {
        console.error('D3.js not loaded!');
        return;
    }

    const config = {
        width: 800,
        height: 500,
        margin: { top: 40, right: 40, bottom: 100, left: 80 }
    };

    let countrySavingsData = [];
    const efficiencyTarget = 100;

    const canvas = d3.select('#waterfall-canvas');

    const waterfallContainer = canvas.append('div')
        .style('width', '100%')
        .style('display', 'flex')
        .style('justify-content', 'center');

    const svg = waterfallContainer.append('svg')
        .attr('viewBox', `0 0 ${config.width} ${config.height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto');

    const chartGroup = svg.append('g')
        .attr('transform', `translate(${config.margin.left},${config.margin.top})`);

    const chartWidth = config.width - config.margin.left - config.margin.right;
    const chartHeight = config.height - config.margin.top - config.margin.bottom;

    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip waterfall-tooltip')
        .style('opacity', 0);

    Promise.all([
        d3.csv('data/exported/country_year_cleaned.csv')
    ]).then(([csvData]) => {

        const processedData = csvData.map(row => {
            const wueIndirect = parseFloatValue(row['WUE_Indirect(L/KWh)']);
            const wueDirect = parseFloatValue(row['WUE_FixedApproachDirect(L/KWh)']);
            const leakages = parseFloatValue(row['Leakages (%)']);

            let totalWUE = null;
            if (!isNaN(wueIndirect) && !isNaN(wueDirect) && wueIndirect > 0 && wueDirect > 0) {
                totalWUE = wueIndirect + wueDirect;
            }

            return {
                country: row.country,
                totalWUE: totalWUE,
                climateRegion: row.climate_region,
                leakages: !isNaN(leakages) ? leakages : 0
            };
        }).filter(d => d.totalWUE !== null && d.climateRegion);

        const dataByCountry = new Map();
        const grouped = d3.group(processedData, d => d.country);

        grouped.forEach((values, country) => {
            const validTotal = values.filter(v => !isNaN(v.totalWUE) && v.totalWUE > 0).map(v => v.totalWUE);
            const avgTotal = validTotal.length > 0 ? d3.mean(validTotal) : NaN;
            const avgLeakages = d3.mean(values.map(v => v.leakages));
            const climateRegion = values[0].climateRegion;

            if (!isNaN(avgTotal)) {
                dataByCountry.set(country, {
                    totalWUE: avgTotal,
                    climateRegion: climateRegion,
                    leakages: avgLeakages
                });
            }
        });

        const byClimate = d3.group(Array.from(dataByCountry.entries()),
            ([country, data]) => data.climateRegion);

        const bestWUEByClimate = new Map();
        const bestLeakageByClimate = new Map();

        byClimate.forEach((countries, climate) => {
            const wueValues = countries.map(([country, data]) => data.totalWUE);
            const leakageValues = countries.map(([country, data]) => data.leakages);
            bestWUEByClimate.set(climate, d3.min(wueValues));
            bestLeakageByClimate.set(climate, d3.min(leakageValues));
        });

        countrySavingsData = Array.from(dataByCountry.entries())
            .map(([country, data]) => {
                const bestWUE = bestWUEByClimate.get(data.climateRegion);
                const bestLeakage = bestLeakageByClimate.get(data.climateRegion);

                const currentCooling = data.totalWUE * (1 - data.leakages);
                const currentLeaked = data.totalWUE * data.leakages;
                const bestCooling = bestWUE * (1 - bestLeakage);
                const bestLeaked = bestWUE * bestLeakage;

                const coolingSavings = currentCooling - bestCooling;
                const leakageSavings = currentLeaked - bestLeaked;
                const totalSavings = coolingSavings + leakageSavings;

                return {
                    country: country,
                    currentWUE: data.totalWUE,
                    bestWUE: bestWUE,
                    climateRegion: data.climateRegion,
                    leakages: data.leakages,
                    bestLeakage: bestLeakage,
                    wueSavings: coolingSavings > 0 ? coolingSavings : 0,
                    leakageSavings: leakageSavings > 0 ? leakageSavings : 0,
                    potentialSavings: totalSavings > 0 ? totalSavings : 0
                };
            })
            .filter(d => d.potentialSavings > 0)
            .sort((a, b) => b.potentialSavings - a.potentialSavings)
            .slice(0, 10);

        drawWaterfallChart(countrySavingsData, efficiencyTarget);

    }).catch(error => {
        console.error('Error loading waterfall data:', error);
    });

    function calculateWaterfallData(savingsData, targetPercent) {
        const multiplier = targetPercent / 100;

        let cumulative = 0;
        const baseline = savingsData.reduce((sum, d) => sum + d.currentWUE, 0);

        const waterfallData = [
            {
                label: 'Current Total',
                value: baseline,
                start: 0,
                end: baseline,
                type: 'total'
            }
        ];

        savingsData.forEach(d => {
            const wueSavings = d.wueSavings * multiplier;
            const leakageSavings = d.leakageSavings * multiplier;
            const totalSavings = wueSavings + leakageSavings;

            const start = baseline - cumulative;
            const end = start - totalSavings;
            cumulative += totalSavings;

            waterfallData.push({
                label: d.country,
                value: -totalSavings,
                start: start,
                end: end,
                type: 'decrease',
                country: d,
                wueSavings: wueSavings,
                leakageSavings: leakageSavings
            });
        });

        waterfallData.push({
            label: 'Optimized Total',
            value: baseline - cumulative,
            start: 0,
            end: baseline - cumulative,
            type: 'total'
        });

        return { waterfallData, totalSavings: cumulative };
    }

    function drawWaterfallChart(savingsData, targetPercent) {
        const { waterfallData, totalSavings } = calculateWaterfallData(savingsData, targetPercent);

        d3.select('#savings-total').text(
            `Total Savings: ${totalSavings.toFixed(2)} L/kWh (-${((totalSavings / waterfallData[0].value) * 100).toFixed(1)}%)`
        );

        const xScale = d3.scaleBand()
            .domain(waterfallData.map(d => d.label))
            .range([0, chartWidth])
            .padding(0.2);

        const maxValue = d3.max(waterfallData, d => Math.max(d.start, d.end));
        const yScale = d3.scaleLinear()
            .domain([0, maxValue * 1.1])
            .range([chartHeight, 0]);

        chartGroup.selectAll('.axis').remove();
        chartGroup.selectAll('.bar').remove();
        chartGroup.selectAll('.bar-segment').remove();
        chartGroup.selectAll('.connector').remove();

        chartGroup.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .style('font-size', '14px')
            .style('fill', 'var(--color-text-secondary)');

        chartGroup.append('g')
            .attr('class', 'axis y-axis')
            .call(d3.axisLeft(yScale).ticks(6))
            .style('color', 'var(--color-text-secondary)')
            .style('font-size', '14px');

        chartGroup.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('y', -60)
            .attr('x', -chartHeight / 2)
            .attr('text-anchor', 'middle')
            .style('fill', 'var(--color-text-primary)')
            .style('font-size', '18px')
            .text('Total WUE (L/kWh)');

        waterfallData.forEach(d => {
            if (d.type === 'total') {
                chartGroup.append('rect')
                    .attr('class', 'bar')
                    .attr('x', xScale(d.label))
                    .attr('y', yScale(d.value))
                    .attr('width', xScale.bandwidth())
                    .attr('height', chartHeight - yScale(d.value))
                    .attr('fill', '#3498DB')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1)
                    .style('cursor', 'pointer')
                    .on('mousemove', (event) => {
                        tooltip.transition().duration(100).style('opacity', 0.95);
                        tooltip.html(`<strong>${d.label}</strong><br><span>Total WUE: ${d.value.toFixed(2)} L/kWh</span>`)
                            .style('left', (event.pageX + 15) + 'px')
                            .style('top', (event.pageY - 30) + 'px');
                    })
                    .on('mouseout', () => {
                        tooltip.transition().duration(200).style('opacity', 0);
                    });
            } else {
                const barTop = yScale(d.start);
                const barBottom = yScale(d.end);
                const totalHeight = Math.abs(barBottom - barTop);

                const totalSavings = d.leakageSavings + d.wueSavings;

                const leakageRatio = totalSavings > 0 ? d.leakageSavings / totalSavings : 0;
                const wueRatio = totalSavings > 0 ? d.wueSavings / totalSavings : 0;

                const leakageHeight = Math.abs(totalHeight * leakageRatio);
                const wueHeight = Math.abs(totalHeight * wueRatio);

                const leakageTop = barTop;
                const wueTop = barTop + leakageHeight;

                chartGroup.append('rect')
                    .attr('class', 'bar-segment leakage-segment')
                    .attr('x', xScale(d.label))
                    .attr('y', leakageTop)
                    .attr('width', xScale.bandwidth())
                    .attr('height', leakageHeight)
                    .attr('fill', '#E67E22')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1);

                chartGroup.append('rect')
                    .attr('class', 'bar-segment wue-segment')
                    .attr('x', xScale(d.label))
                    .attr('y', wueTop)
                    .attr('width', xScale.bandwidth())
                    .attr('height', wueHeight)
                    .attr('fill', '#2ECC71')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 1);

                chartGroup.append('rect')
                    .attr('class', 'bar-overlay')
                    .attr('x', xScale(d.label))
                    .attr('y', barTop)
                    .attr('width', xScale.bandwidth())
                    .attr('height', totalHeight)
                    .attr('fill', 'transparent')
                    .style('cursor', 'pointer')
                    .on('mousemove', (event) => {
                        tooltip.transition().duration(100).style('opacity', 0.95);
                        let content = `<strong>${d.label}</strong><br>`;
                        content += `<span class="tooltip-climate">Climate: ${d.country.climateRegion}</span><br>`;
                        content += `<span class="tooltip-wue"><strong>WUE Savings:</strong> ${d.wueSavings.toFixed(2)} L/kWh</span><br>`;
                        content += `<span class="tooltip-detail">Current: ${d.country.currentWUE.toFixed(2)} → Best: ${d.country.bestWUE.toFixed(2)} L/kWh</span><br>`;
                        content += `<span class="tooltip-leakage"><strong>Leakage Savings:</strong> ${d.leakageSavings.toFixed(2)} L/kWh</span><br>`;
                        content += `<span class="tooltip-detail">Current: ${(d.country.leakages * 100).toFixed(1)}% → Best: ${(d.country.bestLeakage * 100).toFixed(1)}%</span><br>`;
                        content += `<span class="tooltip-total"><strong>Total Savings:</strong> ${(d.wueSavings + d.leakageSavings).toFixed(2)} L/kWh</span>`;
                        tooltip.html(content)
                            .style('left', (event.pageX + 15) + 'px')
                            .style('top', (event.pageY - 30) + 'px');
                    })
                    .on('mouseout', () => {
                        tooltip.transition().duration(200).style('opacity', 0);
                    });
            }
        });

        for (let i = 0; i < waterfallData.length - 1; i++) {
            chartGroup.append('line')
                .attr('class', 'connector')
                .attr('x1', xScale(waterfallData[i].label) + xScale.bandwidth())
                .attr('y1', yScale(waterfallData[i].end))
                .attr('x2', xScale(waterfallData[i + 1].label))
                .attr('y2', yScale(waterfallData[i + 1].start))
                .attr('stroke', 'var(--color-text-muted)')
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '4,2');
        }
    }

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTabs();
        initVisualization();
        initWaterfallChart();
    });
} else {
    initTabs();
    initVisualization();
    initWaterfallChart();
}
