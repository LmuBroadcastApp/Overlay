/**
 * @fileoverview Renders the broadcasting weather panel and short-term forecast.
 */

/**
 * Displays grip, temperatures, wind, and forecast snapshots for the current session.
 */
class WeatherPanel
{
    /**
     * Creates a weather panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`WeatherPanel: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.session = null;
    }

    /**
     * Stores the latest session payload.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'session')
        {
            this.session = value;
        }
    }

    /**
     * Refreshes the weather summary and forecast cells.
     */
    update()
    {
        if (this.session === null)
        {
            return;
        }

        const forecast = this.session.weatherForecast;
        const perc = this.session.currentEventTime / this.session.endEventTime;

        // Index of the forecast interval containing "now". Falls back to the last
        // interval when the session time is past every interval boundary.
        let idx = forecast.length - 1;

        for (let i = 0; i < forecast.length - 1; i++)
        {
            if (forecast[i].idx < perc && perc < forecast[i + 1].idx)
            {
                idx = i;
                break;
            }
        }

        // First column always shows current conditions; remaining columns show
        // the upcoming forecast slots (the final slot is a boundary marker, not shown).
        let header = '<th>󰔛</th>';
        let body = this._forecastCell(this.session.cloudCoverage, this.session.raining * 100);

        for (let i = idx + 1; i < forecast.length - 1; i++)
        {
            header += `<th>${this._forecastTimeLabel(forecast[i])}</th>`;
            body += this._forecastCell(forecast[i].sky, forecast[i].rainChance);
        }

        this.element.querySelector('.weather-panel-track-body').textContent = this._gripLevel2String(this.session.gripLevel, this.session.averagePathWetness);
        this.element.querySelector('.weather-panel-temp-body').innerHTML = `&nbsp;&nbsp;&nbsp;${this.session.trackTemp.toFixed(1)}ºC&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${this.session.ambientTemp.toFixed(1)}ºC`;
        this.element.querySelector('.weather-panel-wind-body').innerHTML = `${this.session.windSpeed.toFixed(1)}&nbsp;Km/h`;

        this.element.querySelector('.weather-panel-forecast-header').innerHTML = header;
        this.element.querySelector('.weather-panel-forecast-body').innerHTML = body;
    }

    /**
     * Builds one forecast table cell (rain-chance progress bar + weather icon).
     * @param {number} sky Sky-state identifier.
     * @param {number} rainChance Rain chance percentage (0-100).
     * @returns {string} Table cell markup.
     */
    _forecastCell(sky, rainChance)
    {
        const icon = `<img src="../shared/img/weather/${sky}.png" alt="" style="width: var(--weather-panel-img-width);"/>`;
        return `<td class="progress-cell" style="--progress: ${rainChance}%;width: var(--weather-panel-img-width);">${icon}</td>`;
    }

    /**
     * Formats the remaining-time label for a future forecast slot.
     * @param {Object} slot Forecast slot with an `idx` fraction of the session.
     * @returns {string} Minutes-remaining label, e.g. "12'".
     */
    _forecastTimeLabel(slot)
    {
        const timeSlot = slot.idx * this.session.endEventTime;
        const remainingTime = timeSlot - this.session.currentEventTime;

        return Math.floor(remainingTime / 60) + "'";
    }

    /**
     * Maps a sky-state code to a weather icon glyph.
     * @param {number} sky Sky-state identifier.
     * @returns {string} Icon glyph.
     */
    _weatherIcon(sky)
    {
        switch (sky)
        {
            case  0: return ''; // Clear
            case  1: return ''; // Light Clouds
            case  2: return ''; // Partially Cloudy
            case  3: return ''; // Mostly Cloudy
            case  4: return ''; // Overcast
            case  5: return ''; // Cloudy & Drizzle
            case  6: return ''; // Cloudy & Light Rain
            case  7: return ''; // Overcast & Light Rain
            case  8: return ''; // Overcast & Rain"
            case  9: return ''; // Overcast & Heavy Rain
            case 10: return ''; // Overcast & Storm
            default: return ''; // Unknown
        }
    }

    /**
     * Converts grip level and wetness into the display label used by the panel.
     * @param {number} gripLevel Grip-level identifier.
     * @param {number} pathWetness Average racing-line wetness.
     * @returns {string} Grip condition label.
     */
    _gripLevel2String(gripLevel, pathWetness)
    {
        if (pathWetness >= 0.9)
        {
            return "Extreme wet";
        }

        if (pathWetness >= 0.6)
        {
            return "Very wet";
        }

        if (pathWetness >= 0.4)
        {
            return "Wet";
        }

        if (pathWetness >= 0.125)
        {
            return "Slightly wet";
        }

        if (pathWetness >= 0.05)
        {
            return "Damp";
        }

        switch (gripLevel)
        {
            case 0: return "Green";
            case 1: return "Low";
            case 2: return "Medium";
            case 3: return "High";
            case 4: return "Saturated";

            default: return String(gripLevel);
        }
    }
}
