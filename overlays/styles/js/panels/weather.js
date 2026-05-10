class WeatherPanel
{
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

    handleStateChange(key, value)
    {
        if (key === 'session')
        {
            this.session = value;
        }
    }

    update()
    {
        if (this.session === null)
        {
            return;
        }

        let when = "󰔛";
        let idx = this.session.weatherForecast.length; let content = "";
        let perc = this.session.currentEventTime / this.session.endEventTime;

        for (let i = 0; i < this.session.weatherForecast.length - 1; ++i)
        {
            let p0 = this.session.weatherForecast[i + 0].idx;
            let p1 = this.session.weatherForecast[i + 1].idx;

            if (p0 < perc && perc < p1)
            {
                idx = i;break;
            }
        }

        let header = "";
        let body = "";

        for (let i = idx; i < this.session.weatherForecast.length - 1; i++)
        {
            if (i > idx)
            {
                let timeSlot = this.session.weatherForecast[i].idx * this.session.endEventTime;
                let remainingTime = timeSlot - this.session.currentEventTime;

                let div = 1.0 / 60.0;
                when = Math.floor(remainingTime * div) + "'";
            }

            let icon = `<img src="styles/img/weather/${this.session.weatherForecast[i].sky}.png" alt="" style="width: var(--weather-panel-img-width);"/>`;
            let time = `${when}`;

            header += `<th>${time}</th>`;
            body += `<td>${icon}</td>`;
        }

        this.element.querySelector('.weather-panel-track-body').textContent = this._gripLevel2String(this.session.gripLevel, this.session.averagePathWetness);
        this.element.querySelector('.weather-panel-temp-body').innerHTML = `&nbsp;&nbsp;&nbsp;${this.session.trackTemp.toFixed(1)}ºC&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${this.session.ambientTemp.toFixed(1)}ºC`;
        this.element.querySelector('.weather-panel-wind-body').innerHTML = `${this.session.windSpeed.toFixed(1)}&nbsp;KM/H`;

        this.element.querySelector('.weather-panel-forecast-header').innerHTML = header;
        this.element.querySelector('.weather-panel-forecast-body').innerHTML = body;
    }

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

            default: return gripLevel;
        }
    }
}
