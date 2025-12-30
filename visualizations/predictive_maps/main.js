function initVisualization() {
    'use strict';

    if (typeof d3 === 'undefined') {
        console.error('D3.js not loaded!');
        return;
    }

    console.log('Predictive Maps visualization initialized');

    /* Configuration */
    const config = {
        width: 500,
        height: 500,
        margin: { top: 10, right: 10, bottom: 10, left: 10 },
        tempMin: 0,
        tempMax: 5,
        tempStep: 0.1,
        wueImpactRate: 0.04,
        transitionDuration: 200
    };

    let currentTemperature = 0;
    let colorScale = null;
    let geoDataEnriched = null;
    let totalCurrentWUE = 0;

    /* Projection Setup */
    const projection = d3.geoMercator()
        .center([20, 5])
        .scale(400)
        .translate([config.width / 2, config.height / 2]);

    const path = d3.geoPath().projection(projection);

    /* DOM Elements */
    const canvas = d3.select('#canvas');

    const leftSection = canvas.append('div')
        .attr('class', 'map-section');

    leftSection.append('h3')
        .text('Current State (Average)');

    const svgLeft = leftSection.append('svg')
        .attr('viewBox', `0 0 ${config.width} ${config.height}`)
        .attr('width', '100%')
        .attr('height', '100%');

    const mapGroupLeft = svgLeft.append('g');

    const rightSection = canvas.append('div')
        .attr('class', 'map-section');

    rightSection.append('h3')
        .text('Projected State (With Temperature Increase)');

    const svgRight = rightSection.append('svg')
        .attr('viewBox', `0 0 ${config.width} ${config.height}`)
        .attr('width', '100%')
        .attr('height', '100%');

    const mapGroupRight = svgRight.append('g');

    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip predictive-tooltip')
        .style('opacity', 0);

    /* Helper Functions */
    function parseFloatValue(value) {
        if (!value || value === "") return NaN;
        return +String(value).replace(",", ".");
    }

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

    /* Tooltip Functions */
    function showTooltipLeft(event, d) {
        const data = d.properties.data;

        if (!data || !data.totalWUE) {
            tooltip.transition().duration(100).style('opacity', 0.95);
            tooltip.html(`
                <strong>${d.properties.name_long}</strong><br>
                <span style="color: var(--color-text-muted);">Data not available</span>
            `)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 30) + 'px');
            return;
        }

        tooltip.transition().duration(100).style('opacity', 0.95);
        tooltip.html(`
            <strong>${d.properties.name_long}</strong><br>
            <span><strong>Current WUE:</strong> ${formatWUE(data.totalWUE)} L/kWh</span><br>
            <span style="font-size: 0.85em; color: var(--color-text-secondary);">
                Indirect: ${formatWUE(data.wueIndirect)} L/kWh<br>
                Direct: ${formatWUE(data.wueDirect)} L/kWh
            </span>
        `)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 30) + 'px');
    }

    function showTooltipRight(event, d) {
        const data = d.properties.data;

        if (!data || !data.totalWUE) {
            tooltip.transition().duration(100).style('opacity', 0.95);
            tooltip.html(`
                <strong>${d.properties.name_long}</strong><br>
                <span style="color: var(--color-text-muted);">Data not available</span>
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
            <span style="color: ${change > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
                <strong>Change:</strong> +${percentChange}% (+${formatWUE(change)} L/kWh)
            </span><br>
            <span style="color: var(--color-accent); font-size: 0.85em;">
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

    /* Data Loading and Processing */
    Promise.all([
        d3.csv('../../data/exported/country_year_cleaned.csv'),
        d3.json('../shared/custom.geo.json')
    ]).then(([csvData, geoData]) => {

        console.log('Data loaded:', {
            csvRows: csvData.length,
            geoFeatures: geoData.features.length
        });

        console.log('Total data rows:', csvData.length);

        const processedData = csvData.map(row => {
            const wueIndirect = parseFloatValue(row['WUE_Indirect(L/KWh)']);
            const wueDirect = parseFloatValue(row['WUE_FixedApproachDirect(L/KWh)']);

            let totalWUE = null;
            if (!isNaN(wueIndirect) && !isNaN(wueDirect) && wueIndirect > 0 && wueDirect > 0) {
                totalWUE = wueIndirect + wueDirect;
            }

            return {
                country: row.country,
                year: row.year,
                wueIndirect: wueIndirect,
                wueDirect: wueDirect,
                totalWUE: totalWUE
            };
        });

        const dataByCountry = new Map();
        const grouped = d3.group(processedData, d => d.country);

        grouped.forEach((values, country) => {
            const validIndirect = values.filter(v => !isNaN(v.wueIndirect) && v.wueIndirect > 0).map(v => v.wueIndirect);
            const validDirect = values.filter(v => !isNaN(v.wueDirect) && v.wueDirect > 0).map(v => v.wueDirect);
            const validTotal = values.filter(v => !isNaN(v.totalWUE) && v.totalWUE > 0).map(v => v.totalWUE);

            const avgIndirect = validIndirect.length > 0 ? d3.mean(validIndirect) : NaN;
            const avgDirect = validDirect.length > 0 ? d3.mean(validDirect) : NaN;
            const avgTotal = validTotal.length > 0 ? d3.mean(validTotal) : NaN;

            dataByCountry.set(country, {
                country: country,
                wueIndirect: avgIndirect,
                wueDirect: avgDirect,
                totalWUE: avgTotal,
                dataPointsCount: values.length
            });
        });

        let matchedCount = 0;
        geoData.features.forEach(feature => {
            const countryName = feature.properties.name_long;
            const countryData = dataByCountry.get(countryName);

            if (countryData && !isNaN(countryData.totalWUE)) {
                feature.properties.data = countryData;
                matchedCount++;
            } else {
                feature.properties.data = null;
                console.log('No data match for:', countryName);
            }
        });

        console.log('Country matches:', matchedCount, '/', geoData.features.length);

        geoDataEnriched = geoData;

        const validWUE = geoData.features
            .map(f => f.properties.data?.totalWUE)
            .filter(v => v != null && !isNaN(v) && v > 0);

        if (validWUE.length === 0) {
            console.error('No valid WUE values found!');
            return;
        }

        console.log('Valid WUE values:', {
            count: validWUE.length,
            min: d3.min(validWUE),
            max: d3.max(validWUE),
            median: d3.median(validWUE)
        });

        const minWUE = d3.min(validWUE);
        const maxWUE = d3.max(validWUE);
        const midWUE = d3.median(validWUE);

        colorScale = d3.scaleLinear()
            .domain([minWUE, midWUE, maxWUE])
            .range(['#2ECC71', '#F39C12', '#E74C3C'])
            .clamp(true);

        totalCurrentWUE = validWUE.reduce((sum, wue) => sum + wue, 0);
        console.log('Total current WUE from all countries:', totalCurrentWUE.toFixed(2), 'L/kWh');

        drawMaps(geoData);
        setupSlider();

    }).catch(error => {
        console.error('Error loading data:', error);
    });

    /* Map Drawing */
    function drawMaps(geoData) {
        mapGroupLeft.selectAll('path')
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
            .on('mousemove', (event, d) => showTooltipLeft(event, d))
            .on('mouseout', hideTooltip);

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

        console.log('Maps rendered successfully');
    }

    /* Slider Setup */
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

        console.log('Temperature slider initialized');
    }

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisualization);
} else {
    initVisualization();
}
