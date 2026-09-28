/** @brief How many grid rows to draw. A full field is far taller than the overlay window. */
const STARTING_GRID_MAX_ROWS = 3;

/** @brief Total sweep time in milliseconds, used when the stylesheet defines no duration. */
const STARTING_GRID_SCROLL_FALLBACK = 40000;

/** @brief Wait before the sweep in milliseconds, used when the stylesheet defines no delay. */
const STARTING_GRID_SCROLL_DELAY_FALLBACK = 0;

/**
 * @brief Origin the backend serves the per car slot images on. Built from the host serving this
 * page rather than a fixed localhost, so the images resolve on a machine that is not the backend,
 * the same way the overlay reaches the rest of the backend. The host falls back to localhost for
 * a page opened straight off disk, where there is no hostname to read.
 */
const STARTING_GRID_IMAGE_ORIGIN = `http://${window.location.hostname || 'localhost'}:6397`;

/**
 * @brief Nerd Font glyphs for the current conditions, matching the icons the driving weather
 * panel already shows, so the two overlays read the same way. Every codepoint is taken from the
 * FiraCode Nerd Font the overlay loads, which is the fallback behind Titillium Web in the font
 * stack, so the private use range resolves without a font-family of its own.
 */
const GRID_WEATHER_GLYPHS =
{
    track: '\uf018',    /** Track surface temperature, fa-road. */
    air: '\uf2c9',      /** Ambient temperature, fa-thermometer_half. */
    rain: '\ue371',     /** Rain chance, weather-raindrop. */
    wet: '\udb83\udd64' /** Path wetness, fa-water. A wave reads as water on the surface, where a droplet would just repeat the rain icon next to it. */
};

/**
 * Draws the starting order as a Formula 1 style grid: a narrow centred pair of columns where
 * the odd positions sit in the left column and the even positions in the right, so pole leads
 * the field and the grid reads as a staggered ladder the way a real track grid does.
 */
class StartingGridPanel
{
    /**
     * Creates a starting grid panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`StartingGridPanel: Element ${selector} not found`);
            return;
        }

        /** Header holds the circuit and weather context, the body holds the grid itself. */
        this.header = this.element.querySelector('#starting-grid-header');
        this.body = this.element.querySelector('#starting-grid-body');

        this.tree = null;
        this.headerHTML = null;
        this.vdom = new VirtualDOM();

        this.counter_standings_curr = 0;
        this.counter_standings_test = 0;

        this.standings = null;
        this.session = this.stateManager.getState('session');

        /** Session changes rebuild the header only, the grid waits for a new standings snapshot. */
        this.headerDirty = true;

        /** Sweep state, driven on its own animation frame while the panel owns the window. */
        this.scroll =
        {
            pending: false, /** Requested, waiting for the grid to be drawn before it can start. */
            active: false,
            duration: 0,
            delay: 0,
            start: 0
        };

        this.controls =
        {
            name_source: 'driver',
            driver_name: 'short'
        };

        this.stateManager.subscribe(this.handleStateChange.bind(this));
    }

    /**
     * Stores standings, session and control updates used by the grid renderer.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.counter_standings_curr++;
            this.standings = value;
        }
        else if (key === 'session')
        {
            this.session = value;
            this.headerDirty = true;
        }
        else if (key === 'overlay_controls')
        {
            this.controls = value;

        }
        else if (key === 'overlay_exclusive')
        {
            if (value === 'grid')
            {
                this._queueScroll();
            }
        }
    }

    /**
     * Requests a sweep from the top of the grid to the bottom, applied as soon as the grid is
     * drawn. A re-shown grid replays the sweep instead of staying where the last one stopped.
     */
    _queueScroll()
    {
        this.scroll.pending = true;
        this.scroll.active = false;
    }

    /**
     * Returns a scroll timing token in milliseconds, read from the variable the backend controls,
     * accepting a plain number of seconds as well as the s and ms time units.
     * @param {string} name CSS custom property name.
     * @param {number} fallback Value used when the variable holds no valid time.
     * @returns {number} Time in milliseconds.
     */
    _scrollTime(name, fallback)
    {
        let value = getComputedStyle(this.element).getPropertyValue(name).trim();

        if (value.endsWith('ms')) return parseFloat(value);

        let seconds = parseFloat(value);
        if (isNaN(seconds)) return fallback;

        return value.endsWith('s') ? seconds * 1000 : seconds;
    }

    /**
     * Starts the sweep once the grid is drawn, so the travel distance can be measured. The wait
     * keeps the grid on screen for a moment before it moves. Later frames run on their own
     * animation frame, see _animateScroll. The body is the scroll viewport, the panel above it
     * holds the header and never moves.
     */
    _beginScroll()
    {
        if (this.tree === null) return;

        this.scroll.pending = false;
        this.scroll.duration = this._scrollTime('--starting-grid-scroll-duration', STARTING_GRID_SCROLL_FALLBACK);
        this.scroll.delay = this._scrollTime('--starting-grid-scroll-delay', STARTING_GRID_SCROLL_DELAY_FALLBACK);
        this.scroll.start = 0;
        this.scroll.active = this.scroll.duration > 0;

        this.body.scrollTop = 0;
        this._animateScroll();
    }

    /**
     * Walks the grid from the top to the bottom over the configured duration, after the
     * configured wait. The sweep runs on its own animation frame rather than on the panel update,
     * which is capped well below the display rate and would show as steps. The travel distance is
     * measured every frame so the sweep still lands on the bottom when the grid resizes mid flight.
     *
     * @param {?(number)} now Frame timestamp in milliseconds, taken on the first frame.
     */
    _animateScroll(now)
    {
        if (!this.scroll.active) return;

        now = now ?? performance.now();
        if (this.scroll.start === 0) this.scroll.start = now + this.scroll.delay;

        let progress = Math.max(0, Math.min(1, (now - this.scroll.start) / this.scroll.duration));
        this.body.scrollTop = Math.max(0, this.body.scrollHeight - this.body.clientHeight) * progress;
        this.scroll.active = progress < 1;

        if (this.scroll.active) requestAnimationFrame((timestamp) => this._animateScroll(timestamp));
    }

    /**
     * Rebuilds and patches the header and the grid when their data changes or the sweep restarts.
     * The two are kept apart because the session clock pushes a new session every second while
     * the grid only changes when the standings snapshot does.
     */
    update()
    {
        if (this.scroll.pending)
        {
            this._beginScroll();
        }

        if (this.headerDirty)
        {
            this._renderHeader();
        }

        if (this.standings == null || this.standings.length === 0)
        {
            if (this.tree !== null)
            {
                this.tree = null;
                this.vdom.render(this.vdom.h('div'), this.body);
            }

            return;
        }

        if (this.counter_standings_curr === this.counter_standings_test)
        {
            return;
        }

        this.counter_standings_test = this.counter_standings_curr;
        let newTree = this._buildTree();

        if (this.tree === null)
        {
            this.tree = this.vdom.render(newTree, this.body);
        }
        else
        {
            this.tree = this.vdom.patch(this.tree, newTree, this.body);
        }
    }

    /**
     * Patches the header after a session update. The header is a single block of markup rather
     * than a tree of nodes, so it is handed to innerHTML instead of going through the vdom, which
     * would only ever wrap it in a second element.
     */
    _renderHeader()
    {
        this.headerDirty = false;

        let html = this.session === null ? '' : this._buildHeaderHTML();

        // A new session arrives every second while most of the header stays the same, so the
        // markup is only written once it really changed, which keeps the forecast icons from
        // being torn down and loaded again on every push.
        if (html === this.headerHTML) return;

        this.headerHTML = html;
        this.header.innerHTML = html;
    }

    /**
     * Builds the header markup, which introduces the grid with the circuit it is run on, the
     * conditions the field is about to drive in, and how those conditions are forecast to change.
     * The markup is composed as a string and assigned to innerHTML by _renderHeader, so every
     * value coming from the payload is escaped before it is interpolated. It is empty until a
     * session with a known track arrives.
     * @returns {string} Header markup.
     */
    _buildHeaderHTML()
    {
        return `<div class='grid-header-block'>
                <span class='grid-header-label'>Track</span>
                <strong class='grid-header-value'>${HtmlEscape(this.session.trackName)}</strong>
                <span class='grid-header-sub'>${this._getTrackSummary(this.session)}</span>
            </div>
            <div class='grid-header-block'>
                <span class='grid-header-label'>Weather</span>
                ${this._buildWeatherHTML(this.session)}
            </div>
            <div class='grid-header-block grid-header-forecast'>
                <span class='grid-header-label'>Forecast</span>
                <div class='grid-forecast'>${this._buildForecastHTML(this.session)}</div>
            </div>`;
    }

    /**
     * Summarizes the circuit and the session, showing the track length only when the backend
     * reports a usable one.
     * @param {Object} session Session payload.
     * @returns {string} Session name and track length.
     */
    _getTrackSummary(session)
    {
        let parts = [];

        if (session.name) parts.push(session.name);

        if (Number.isFinite(session.trackDistance) && session.trackDistance > 0)
        {
            parts.push(`${(session.trackDistance / 1000).toFixed(3)} km`);
        }

        return parts.map(part => HtmlEscape(part)).join(' &middot; ');
    }

    /**
     * Builds the conditions right now as one glyph and reading pair per sensor, which is how the
     * driving weather panel shows them. The glyph names what the reading is, so the header needs
     * no Track / Air / Rain / Wet prefixes to stay readable, and each pair keeps a title naming
     * its sensor for anyone reading the page source or a tooltip. Every reading is produced by a
     * formatter rather than interpolated raw from the payload, so nothing here needs escaping.
     * @param {Object} session Session payload.
     * @returns {string} Current conditions markup.
     */
    _buildWeatherHTML(session)
    {
        return `<div class='grid-weather'>
                <span class='grid-weather-cell' title='Track temperature'>${GRID_WEATHER_GLYPHS.track}`
            + `<b>${StartingGridPanel.FormatReading(session.trackTemp)}°C</b></span>
                <span class='grid-weather-cell' title='Air temperature'><span class='glyph-air'>${GRID_WEATHER_GLYPHS.air}</span>`
            + `<b>${StartingGridPanel.FormatReading(session.ambientTemp)}°C</b></span>
                <span class='grid-weather-cell' title='Rain'><span class='glyph-rain'>${GRID_WEATHER_GLYPHS.rain}</span>`
            + `<b>${StartingGridPanel.PercentReading(session.raining)}</b></span>
                <span class='grid-weather-cell' title='Track wetness'>${GRID_WEATHER_GLYPHS.wet}`
            + `<b>${StartingGridPanel.PercentReading(session.averagePathWetness)}</b></span>
            </div>`;
    }

    /**
     * Formats a sensor reading with a single decimal, falling back to a placeholder so a session
     * payload that leaves a reading out cannot break the whole header.
     * @param {*} value Reading from the session payload.
     * @returns {string} Formatted reading.
     */
    static FormatReading(value)
    {
        return Number.isFinite(value) ? value.toFixed(1) : '--';
    }

    /**
     * Formats a reading the backend sends as a fraction of one, the way rain and path wetness both
     * arrive, as a percentage. Scaling here rather than at the call site keeps the two the header
     * shows from silently reading as a fraction under a percent sign.
     * @param {*} value Reading from the session payload, between 0 and 1.
     * @returns {string} Formatted percentage.
     */
    static PercentReading(value)
    {
        return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '--';
    }

    /**
     * Builds the upcoming weather forecast cells, the first one showing the conditions right now
     * and the following ones the upcoming forecast slots. The last slot is a boundary marker, so
     * it is never drawn.
     * @param {Object} session Session payload.
     * @returns {string} Forecast cell markup.
     */
    _buildForecastHTML(session)
    {
        const forecast = session.weatherForecast;

        if (!forecast || forecast.length === 0)
        {
            return '';
        }

        const perc = session.currentEventTime / session.endEventTime;

        // Index of the forecast interval containing "now", which falls back to the last interval
        // when the session clock is past every interval boundary.
        let idx = forecast.length - 1;

        for (let i = 0; i < forecast.length - 1; i++)
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
        let rain = Number.isFinite(session.raining) ? session.raining * 100 : 0;

        for (let i = idx; i < forecast.length - 1; i++)
        {
            if (i > idx)
            {
                const timeSlot = forecast[i].idx * session.endEventTime;
                const remaining = timeSlot - session.currentEventTime;

                when = Math.floor(remaining / 60) + "'";
                sky = forecast[i].sky;
                rain = forecast[i].rainChance;
            }

            html += `<div class='grid-forecast-cell'>
                <span class='grid-forecast-when'>${when}</span>
                <img src='../shared/img/weather/${sky}.png' alt=''/>
                <span class='grid-forecast-rain'>${Math.round(rain)}%</span>
            </div>`;
        }

        return html;
    }

    /**
     * Returns the grid order, which follows the qualy position assigned by the session.
     * @returns {Array<Object>} Vehicles sorted by starting position.
     */
    _getGridOrder()
    {
        return [...this.standings].sort((a, b) => a.qualy_position - b.qualy_position);
    }

    /**
     * Returns the slot image for a vehicle, which the backend supplies per car, falling back to
     * the manufacturer logo when the payload carries no vehicle image.
     * @param {Object} vehicle Vehicle data.
     * @param (boolean) logo Manufacturer logo.
     * @returns {string} Image source path or URL.
     */
    static GetSlotImage(vehicle, logo)
    {
        if(logo === false)
        {
            let image = vehicle.image_name?.trim();
            if (image) return `${STARTING_GRID_IMAGE_ORIGIN}/start/images/cars/${image}_frontAngle.webp`;
        }

        let manufacturer = vehicle.manufacturer?.trim() || 'Default';
        return `../shared/img/brandlogo/${manufacturer}.png`;
    }

    /**
     * Returns the fastest qualifying lap in a class, which is what every car in that class is
     * measured against. The baseline is taken from the cars that actually set a time rather than
     * from the class pole, because a pole that never set a lap would otherwise turn every gap in
     * the class into that car's own lap time. The floor matches the one LaptimeToString uses, so a
     * placeholder lap is never treated as a real one here either.
     *
     * @param {Array<Object>} value Vehicles in one class.
     * @returns {?number} Fastest lap in seconds, or null when no car in the class set one.
     */
    _getClassBestLap(value)
    {
        const laps = value
            .map(vehicle => vehicle.qualy_best_lap)
            .filter(laptime => Number.isFinite(laptime) && laptime > 0.1);

        return laps.length === 0 ? null : Math.min(...laps);
    }

    /**
     * Returns a car's gap to the class best lap. The gap is empty when either time is missing, so
     * a car that never set a lap shows nothing rather than a number measured against zero.
     *
     * @param {*} laptime Car qualifying lap in seconds.
     * @param {?number} best_lap_time Fastest lap in the class.
     * @returns {string} Gap to the class best, or an empty string when there is nothing to compare.
     */
    _getLapDelta(laptime, best_lap_time)
    {
        if (!Number.isFinite(laptime) || !Number.isFinite(best_lap_time)) return '';

        const gap = laptime - best_lap_time;
        if (gap < 0.001) return 'Pole position';

        return `+${gap.toFixed(3)}`;
    }

    /**
     * Builds one grid slot. The markup is composed as a string and handed to the vdom through the
     * htmlContent attribute, which assigns it to innerHTML, so every value coming from the
     * payload is escaped before it is interpolated.
     *
     * @param {Object} vehicle Vehicle data.
     * @param {string} side 'left' or 'right', the column the slot is drawn in.
     * @param {integer} best_lap_time best class lap time.
     * @returns {string} Slot markup.
     */
    _buildCard(vehicle, side, best_lap_time)
    {
        const name = DriverToNameParts(vehicle.driver);
        const driver = (vehicle.driver ?? '').trim();

        let pos = vehicle.qualy_position_class;
        const lap = LaptimeToString(vehicle.qualy_best_lap);
        const delta = this._getLapDelta(vehicle.qualy_best_lap, best_lap_time);

        if (pos < 1)
        {
            pos = vehicle.qualy_position;
        }

        const carImage = StartingGridPanel.GetSlotImage(vehicle, false);
        const logoImage = StartingGridPanel.GetSlotImage(vehicle, true);

        return `<div class='driver-card ${side} ${CSSClassFromVehicleClass(vehicle.vehicle_class)}'>
            <div class='driver-head'>
                <div class='card-number'>${HtmlEscape(pos)}</div>
                <div class='driver-name'>
                    <small>${HtmlEscape(name.first)}</small>
                    <strong>${HtmlEscape(name.last)}</strong>
                </div>
                <div class='team-badge'></div>
                <img class='portrait' src='${HtmlEscape(logoImage)}' alt='${HtmlEscape(driver)} driver'/>
            </div>
            <div class='car-area'>
                <img src='${HtmlEscape(carImage)}' data-fallback='${HtmlEscape(logoImage)}' onerror='this.onerror=null;this.src=this.dataset.fallback' alt='${HtmlEscape(driver)} car'/>
                <div class='lap'>${HtmlEscape(lap)}<small>${HtmlEscape(delta)}</small></div>
                <div class='meta'>${HtmlEscape(vehicle.vehicle_name)}<span>${HtmlEscape(vehicle.vehicle_class)}</span></div>
            </div>
        </div>`;
    }

    /**
     * Builds the staggered pair of columns, odd positions on the left so pole leads the ladder.
     * @returns {*} Virtual DOM grid node.
     */
    _buildGrid()
    {
        if (this.standings.length === 0)
        {
            return this.vdom.h('div', { className: 'grid' });
        }

        let html = '';

        /**
         * Rows are numbered across the whole field rather than per class. A class block that
         * restarted at Row 1 read as a second grid, and nothing on screen said why. Each row also
         * carries its own number within its class, so the field wide one has something to sit
         * beside rather than being the only reading on offer.
         */
        let row = 1;

        let order = this._getGridOrder();
        const perClass = GetByClasses(order);

        perClass.forEach((value, key) =>
        {
            /** Each class is named once above its own block of rows, since it is drawn as one. */
            html += `<div class='class-label ${CSSClassFromVehicleClass(key)}'>${HtmlEscape(key)}</div>`;

            let best_lap_time = this._getClassBestLap(value);

            /** Row number within this class, which restarts at every class block. */
            let class_row = 1;

            for (let i = 0; i < value.length; i += 2)
            {
                html += `<div class='row-labels'>
                    <div class='row-label row-label-class'>Row ${class_row++}</div>
                    <div class='row-label'>Row ${row++}</div>
                </div>`;
                html += `<div class='grid-row'>${this._buildCard(value[i], 'left', best_lap_time)}`;

                if (i + 1 <value.length)
                {
                    html += this._buildCard(value[i + 1], 'right', best_lap_time);
                }
                html += '</div>';
            }
        });


        return this.vdom.h('div', { className: 'grid', htmlContent: html });
    }


    /**
     * Builds the full panel tree.
     * @returns {*} Virtual DOM tree.
     */
    _buildTree()
    {
        return this._buildGrid();
    }
}
