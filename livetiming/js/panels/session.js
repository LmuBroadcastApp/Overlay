/**
 * @file Session header panel for livetiming.
 */

/**
 * Renders session, flag, weather, and forecast information in the page header.
 */
class SessionPanel
{
    /**
     * Creates the session header panel.
     *
     * @param {string} selector Root DOM selector for the panel.
     * @param {StateManager} stateManager Shared page state manager.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`SessionPanel: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.session = this.stateManager.getState('session');
    }

    /**
     * Reacts to relevant state changes.
     *
     * @param {string} key Changed state key.
     * @param {*} value New state value.
     */
    handleStateChange(key, value)
    {
        if (key === 'session')
        {
            this.session = value;
        }
    }

    /**
     * Re-renders the session header from the latest session state.
     */
    update()
    {
        if (this.session === null) return;

        this.element.querySelector('#session-name').innerHTML = this.session.name;
        this.element.querySelector('#session-time').innerHTML = this.getSessionTimeString(this.session);

        this.element.querySelector('#track-name').innerHTML = this.session.trackName;
        this.element.querySelector('#track-status').innerHTML = this.getTrackStatusHTML(this.session);

        this.element.querySelector('#weather-value').innerHTML = this.getTemperatureString(this.session);
        this.element.querySelector('#weather-forecast').innerHTML = this.getForecastHTML(this.session);
    }

    /**
     * Builds the upcoming weather forecast strip.
     *
     * @param {Object} session Session payload.
     * @returns {string} HTML string for the forecast cells.
     */
    getForecastHTML(session)
    {
        const forecast = session.weatherForecast;

        if (!forecast || forecast.length === 0)
        {
            return '';
        }

        const perc = session.currentEventTime / session.endEventTime;
        let idx = forecast.length;

        for (let i = 0; i < forecast.length - 1; ++i)
        {
            if (forecast[i].idx < perc && perc < forecast[i + 1].idx)
            {
                idx = i;
                break;
            }
        }

        let html = '';
        let when = 'Now';
        let sky = session.cloudCoverage || 0;
        let rain = session.raining;

        for (let i = idx; i < forecast.length - 1; ++i)
        {
            if (i > idx)
            {
                const timeSlot = forecast[i].idx * session.endEventTime;
                const remaining = timeSlot - session.currentEventTime;

                when = Math.floor(remaining / 60) + "'";
                sky = forecast[i].sky;
                rain = forecast[i].rainChance;
            }

            html += `<div class="forecast-cell">
                <span class="forecast-when">${when}</span>
                <img src="../shared/img/weather/${sky}.png" alt=""/>
                <span class="forecast-rain">${Math.round(rain)}%</span>
            </div>`;
        }

        return html;
    }

    /**
     * Formats remaining session time as hh:mm:ss.
     *
     * @param {Object} session Session payload.
     * @returns {string} Formatted countdown string.
     */
    getSessionTimeString(session)
    {
        let remaining = Math.floor(session.endEventTime - session.currentEventTime);
        remaining = Math.max(0, remaining);

        let hours = Math.floor(remaining / 3600);
        remaining %= 3600;

        let minutes = Math.floor(remaining / 60);
        let seconds = remaining % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Builds the S1/S2/S3 flag chips for the header.
     *
     * @param {Object} session Session payload.
     * @returns {string} HTML string for the sector chips.
     */
    getTrackStatusHTML(session)
    {
        let html = '';

        for (let i = 0; i < session.sectorFlags.length; ++i)
        {
            const active = session.sectorFlags[i] ? ' active' : '';
            html += `<span class="sector-flag${active}">S${i + 1}</span>`;
        }

        return html;
    }

    /**
     * Formats the compact weather summary text.
     *
     * @param {Object} session Session payload.
     * @returns {string} Compact weather summary.
     */
    getTemperatureString(session)
    {
        return `Track: ${session.trackTemp.toFixed(1)}°C / Air: ${session.ambientTemp.toFixed(1)}°C / Rain: ${session.raining.toFixed(1)}% / Wet: ${session.averagePathWetness.toFixed(1)}%`;
    }
}
