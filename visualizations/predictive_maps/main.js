// Predictive Maps Visualization
// Side-by-side comparison: Current WUE vs Projected WUE with Temperature Increase
// Water Usage Effectiveness for African Data Centers

// Wait for DOM and D3 to be ready
function initVisualization() {
    'use strict';

    // Check if D3 is loaded
    if (typeof d3 === 'undefined') {
        console.error('D3.js not loaded!');
        return;
    }

    console.log('Predictive Maps visualization initialized');

    // ============================================
    // CONFIGURATION
    // ============================================
    const config = {
        width: 500,
        height: 500,
        margin: { top: 10, right: 10, bottom: 10, left: 10 },
        tempMin: 0,
        tempMax: 5,
        tempStep: 0.1,
        wueImpactRate: 0.04, // 4% increase per degree Celsius
        transitionDuration: 200
    };

    // Global state
    let currentTemperature = 0;
    let colorScale = null;
    let geoDataEnriched = null;

    // ============================================
    // PROJECTION SETUP
    // ============================================
    const projection = d3.geoMercator()
        .center([20, 5])
        .scale(400)
        .translate([config.width / 2, config.height / 2]);

    const path = d3.geoPath().projection(projection);

    // ============================================
    // DOM ELEMENTS
    // ============================================
    const canvas = d3.select('#canvas');

    // Left map section
    const leftSection = canvas.append('div')
        .attr('class', 'map-section');

    leftSection.append('h3')
        .text('Current State (2024)');

    const svgLeft = leftSection.append('svg')
        .attr('viewBox', `0 0 ${config.width} ${config.height}`)
        .attr('width', '100%')
        .attr('height', '100%');

    const mapGroupLeft = svgLeft.append('g');

    // Right map section
    const rightSection = canvas.append('div')
        .attr('class', 'map-section');

    rightSection.append('h3')
        .text('Projected State (With Temperature Increase)');

    const svgRight = rightSection.append('svg')
        .attr('viewBox', `0 0 ${config.width} ${config.height}`)
        .attr('width', '100%')
        .attr('height', '100%');

    const mapGroupRight = svgRight.append('g');

    // Tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip predictive-tooltip')
        .style('opacity', 0);

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Parse float value, handling comma decimal separators
     */
    function parseFloatValue(value) {
        if (!value || value === "") return NaN;
        return +String(value).replace(",", ".");
    }

    /**
     * Calculate projected WUE based on temperature increase
     */
    function calculateProjectedWUE(currentWUE, tempIncrease) {
        return currentWUE * (1 + tempIncrease * config.wueImpactRate);
    }

    /**
     * Format WUE value for display
     */
    function formatWUE(value) {
        return value != null && !isNaN(value) ? value.toFixed(2) : 'N/A';
    }

    /**
     * Calculate percentage change
     */
    function calculatePercentChange(current, projected) {
        if (!current || current === 0) return 0;
        return ((projected - current) / current * 100).toFixed(1);
    }

    // ============================================
    // TOOLTIP FUNCTIONS
    // ============================================

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

    // ============================================
    // MAP UPDATE FUNCTION
    // ============================================

    function updateProjectedMap(tempIncrease) {
        currentTemperature = tempIncrease;

        // Update temperature display
        d3.select('#temp-value').text(`+${tempIncrease.toFixed(1)}°C`);

        // Update right map colors
        mapGroupRight.selectAll('path.country')
            .interrupt() // Stop any ongoing transitions
            .transition()
            .duration(config.transitionDuration)
            .attr('fill', d => {
                const wue = d.properties.data?.totalWUE;
                if (!wue || isNaN(wue) || wue <= 0) return '#ccc';

                const projected = calculateProjectedWUE(wue, tempIncrease);
                return colorScale(projected);
            });
    }

    // ============================================
    // DATA LOADING AND PROCESSING
    // ============================================

    Promise.all([
        d3.csv('../../data/exported/country_year_cleaned.csv'),
        d3.json('../shared/custom.geo.json')
    ]).then(([csvData, geoData]) => {

        console.log('Data loaded:', {
            csvRows: csvData.length,
            geoFeatures: geoData.features.length
        });

        // Filter for 2024 baseline data
        const data2024 = csvData.filter(d => String(d.year) === "2024");
        console.log('2024 data rows:', data2024.length);

        // Calculate Total WUE for each country
        const processedData = data2024.map(row => {
            const wueIndirect = parseFloatValue(row['WUE_Indirect(L/KWh)']);
            const wueDirect = parseFloatValue(row['WUE_FixedApproachDirect(L/KWh)']);

            let totalWUE = null;
            if (!isNaN(wueIndirect) && !isNaN(wueDirect) && wueIndirect > 0 && wueDirect > 0) {
                totalWUE = wueIndirect + wueDirect;
            }

            return {
                country: row.country,
                wueIndirect: wueIndirect,
                wueDirect: wueDirect,
                totalWUE: totalWUE
            };
        });

        // Group by country (take first entry if multiple)
        const dataByCountry = d3.group(processedData, d => d.country);

        // Enrich GeoJSON features with WUE data
        let matchedCount = 0;
        geoData.features.forEach(feature => {
            const countryName = feature.properties.name_long;
            const countryData = dataByCountry.get(countryName);

            if (countryData && countryData.length > 0) {
                feature.properties.data = countryData[0];
                matchedCount++;
            } else {
                feature.properties.data = null;
                console.log('No data match for:', countryName);
            }
        });

        console.log('Country matches:', matchedCount, '/', geoData.features.length);

        // Store enriched data globally
        geoDataEnriched = geoData;

        // Extract valid WUE values for color scale
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

        // Create color scale
        const minWUE = d3.min(validWUE);
        const maxWUE = d3.max(validWUE);
        const midWUE = d3.median(validWUE);

        colorScale = d3.scaleLinear()
            .domain([minWUE, midWUE, maxWUE])
            .range(['#2ECC71', '#F39C12', '#E74C3C']) // Green → Yellow → Red
            .clamp(true);

        // Draw maps
        drawMaps(geoData);

        // Setup slider
        setupSlider();

    }).catch(error => {
        console.error('Error loading data:', error);
    });

    // ============================================
    // MAP DRAWING
    // ============================================

    function drawMaps(geoData) {
        // LEFT MAP - Current State
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

        // RIGHT MAP - Projected State (initially at 0°C, same as left)
        mapGroupRight.selectAll('path')
            .data(geoData.features)
            .join('path')
            .attr('d', path)
            .attr('class', 'country')
            .attr('fill', d => {
                const wue = d.properties.data?.totalWUE;
                if (!wue || isNaN(wue) || wue <= 0) return '#ccc';
                return colorScale(wue); // Initially same as left (0°C)
            })
            .attr('stroke', '#ffffff')
            .attr('stroke-width', '1px')
            .on('mousemove', (event, d) => showTooltipRight(event, d))
            .on('mouseout', hideTooltip);

        console.log('Maps rendered successfully');
    }

    // ============================================
    // SLIDER SETUP
    // ============================================

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

// Execute when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVisualization);
} else {
    // DOM already loaded
    initVisualization();
}
