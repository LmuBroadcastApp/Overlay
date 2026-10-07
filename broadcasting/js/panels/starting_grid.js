/** @brief Default number of grid rows per page. Three rows put six cars on screen at once. */
const STARTING_GRID_PAGE_ROWS = 3;

/** @brief Maximum configurable rows per page that remain readable after the page is fitted. */
const STARTING_GRID_PAGE_ROWS_MAX = 4;

/** @brief Page hold time in milliseconds when the stylesheet defines no duration (five seconds). */
const STARTING_GRID_PAGE_FALLBACK = 5000;

/**
 * @brief Hold time in milliseconds for the last page when the stylesheet defines none. The field
 * has been shown in full by then, so the last page stays up far longer than a page in the middle
 * of the sweep before the pager wraps back to the first.
 */
const STARTING_GRID_LAST_PAGE_FALLBACK = 30000;

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
        this.footer = this.element.querySelector('#starting-grid-pager');

        this.tree = null;
        this.headerHTML = null;
        this.vdom = new VirtualDOM();

        this.counter_standings_curr = 0;
        this.counter_standings_test = 0;

        this.standings = null;
        this.session = this.stateManager.getState('session');
        this.map = this.stateManager.getState('map');

        /** Session changes rebuild the header only, the grid waits for a new standings snapshot. */
        this.headerDirty = true;
        this.mapDirty = true;

        /** Pager state. Pages advance on their own timer while the panel owns the window. */
        this.pager =
        {
            pending: false,       /** Requested, waiting for the grid to be drawn before it can start. */
            index: 0,             /** Current page, zero based. */
            total: 0,             /** Number of pages in the current field. */
            duration: 0,          /** Hold time per page in milliseconds. */
            lastDuration: 0,      /** Hold time for the last page in milliseconds, before wrapping to the first. */
            started: 0,           /** When the current page timer was armed, from performance.now(). */
            timer: null           /** Timeout that turns the next page. */
        };

        /** Set when the page changes, so the grid is redrawn without a new standings snapshot. */
        this.pageDirty = false;
        this.pageRows = STARTING_GRID_PAGE_ROWS;

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
        else if (key === 'map')
        {
            this.map = value;
            this.mapDirty = true;
        }
        else if (key === 'overlay_controls')
        {
            this.controls = value;

            const pageRows = this._getPageRows();
            if (pageRows !== this.pageRows)
            {
                this.pageRows = pageRows;
                this.pager.index = 0;
                this.pageDirty = true;
            }
        }
        else if (key === 'overlay_exclusive')
        {
            if (value === 'grid')
            {
                this._queuePager();
            }
            else
            {
                this._stopPager();
            }
        }
    }

    /**
     * Returns the configured number of rows per page. Invalid and missing values preserve the
     * two-row default; large values are capped before the page becomes unreadably small.
     * @returns {number} Number of grid rows to draw on one page.
     */
    _getPageRows()
    {
        const rows = Number(this.controls?.grid_page_rows);

        if (!Number.isInteger(rows) || rows < 1)
        {
            return STARTING_GRID_PAGE_ROWS;
        }

        return Math.min(rows, STARTING_GRID_PAGE_ROWS_MAX);
    }

    /**
     * Requests the pager from the first page, applied as soon as the grid is drawn. A re-shown
     * grid starts again on page one instead of staying where the last run left it.
     */
    _queuePager()
    {
        this.pager.pending = true;
    }

    /**
     * Stops the pager and forgets the pending start, so the timer does not keep turning pages
     * while another overlay owns the window.
     */
    _stopPager()
    {
        this.pager.pending = false;

        if (this.pager.timer !== null)
        {
            clearTimeout(this.pager.timer);
            this.pager.timer = null;
        }
    }

    /**
     * Returns a page timing token in milliseconds, read from the variable the backend controls,
     * accepting a plain number of seconds as well as the s and ms time units.
     * @param {string} name CSS custom property name.
     * @param {number} fallback Value used when the variable holds no valid time.
     * @returns {number} Time in milliseconds.
     */
    _pageTime(name, fallback)
    {
        let value = getComputedStyle(this.element).getPropertyValue(name).trim();

        if (value.endsWith('ms')) return parseFloat(value);

        let seconds = parseFloat(value);
        if (isNaN(seconds)) return fallback;

        return value.endsWith('s') ? seconds * 1000 : seconds;
    }

    /**
     * Returns how long the page currently on screen stays up. The last page holds for its own,
     * longer, time, so the field has finished when the pager wraps back to the first page.
     * @returns {number} Hold time in milliseconds.
     */
    _holdTime()
    {
        const onLastPage = this.pager.total > 1 && this.pager.index === this.pager.total - 1;
        return onLastPage ? this.pager.lastDuration : this.pager.duration;
    }

    /**
     * Starts the pager once the grid is drawn. Page one is shown straight away, then the timer
     * turns pages on the configured cadence until the overlay is hidden. Every page apart from the
     * last stays up for the same number of seconds, the last one for its own longer hold before
     * the sweep starts again from page one. A duration of zero turns the pager off and leaves the
     * grid on page one.
     */
    _beginPager()
    {
        if (this.tree === null)
        {
            return;
        }

        this.pager.pending = false;
        this.pager.index = 0;
        this.pageDirty = true;

        this.pager.duration = this._pageTime('--starting-grid-page-duration', STARTING_GRID_PAGE_FALLBACK);
        this.pager.lastDuration = this._pageTime('--starting-grid-last-page-duration', STARTING_GRID_LAST_PAGE_FALLBACK);

        this._stopPager();
        if (this.pager.duration <= 0) return;

        this.pager.started = performance.now();
        this.pager.timer = setTimeout(() => this._advance(), this._holdTime());
    }

    /**
     * Turns to the next page, wrapping from the last page back to the first, and arms the timer
     * for the following page. The page just turned to decides how long it stays up, so the last
     * page holds before the sweep restarts. The grid and pager are redrawn on the next panel
     * update, see update.
     */
    _advance()
    {
        if (this.pager.total > 1)
        {
            this.pager.index = (this.pager.index + 1) % this.pager.total;
            this.pageDirty = true;
        }

        const hold = this._holdTime();

        if (hold > 0)
        {
            this.pager.started = performance.now();
            this.pager.timer = setTimeout(() => this._advance(), hold);
        }
    }

    /**
     * Rebuilds and patches the header and the grid when their data changes or the sweep restarts.
     * The two are kept apart because the session clock pushes a new session every second while
     * the grid only changes when the standings snapshot does.
     */
    update()
    {
        if (this.pager.pending)
        {
            this._beginPager();
        }

        if (this.headerDirty)
        {
            this._renderHeader();
        }

        if (this.mapDirty)
        {
            this._renderTrackMap();
        }

        if (this.standings == null || this.standings.length === 0)
        {
            if (this.tree !== null)
            {
                this.tree = null;
                this.vdom.render(this.vdom.h('div'), this.body);
            }

            this.pager.total = 0;
            if (this.footer) this.footer.innerHTML = '';
            return;
        }

        if (this.counter_standings_curr === this.counter_standings_test && !this.pageDirty)
        {
            return;
        }

        this.counter_standings_test = this.counter_standings_curr;
        this.pageDirty = false;
        let newTree = this._buildTree();

        if (this.tree === null)
        {
            this.tree = this.vdom.render(newTree, this.body);
        }
        else
        {
            this.tree = this.vdom.patch(this.tree, newTree, this.body);
        }

        this._renderPager();
        this._fitPage();
    }

    /**
     * Scales the page down when it is larger than the body it sits in, so neither the sidebar nor
     * the pager can force a row off screen. Scaling the whole ladder keeps the stagger and centre
     * gap in proportion, where dropping a row would change what is on screen.
     */
    _fitPage()
    {
        const grid = this.body?.firstElementChild;
        if (!grid) return;

        // Measured unscaled, so the scale of the previous page cannot feed back into the next one.
        grid.style.setProperty('--page-scale', 1);

        const availableHeight = this.body.clientHeight;
        const availableWidth = this.body.clientWidth;

        const neededHeight = grid.scrollHeight;
        const neededWidth = grid.scrollWidth;

        const scale = Math.min(
            1,
            neededHeight > 0 ? availableHeight / neededHeight : 1,
            neededWidth > 0 ? availableWidth / neededWidth : 1
        );

        if (scale < 1)
        {
            grid.style.setProperty('--page-scale', scale);
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

        this.mapDirty = true;
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
                <strong class='grid-header-value'>${HtmlEscape(this.session.trackName)}</strong>
                <span class='grid-header-sub'>${this._getTrackSummary(this.session, this.standings)}</span>
            </div>
            <div class='grid-header-group'>
                <div class='grid-header-map'>
                    <span class='grid-header-label'>Circuit</span>
                    <canvas class='grid-header-map-canvas' aria-label='Circuit map'></canvas>
                </div>
                <div class='grid-header-divider'></div>
                <div class='grid-header-block grid-header-weather'>
                    <span class='grid-header-label'>Weather</span>
                    ${this._buildWeatherHTML(this.session)}
                </div>
                <div class='grid-header-divider'></div>
                <div class='grid-header-block grid-header-forecast'>
                    <span class='grid-header-label'>Forecast</span>
                    <div class='grid-forecast'>${this._buildForecastHTML(this.session)}</div>
                </div>
            </div>`;
    }

    /**
     * Draws a circuit-only miniature in the sidebar. The full map panel owns live vehicle markers
     * and warnings; this view deliberately keeps only the track, pit lane and sector boundaries so
     * it remains legible at the smaller size.
     */
    _renderTrackMap()
    {
        this.mapDirty = false;

        const canvas = this.header?.querySelector('.grid-header-map-canvas');
        const map = this.map;

        if (!canvas || !map?.track_map || map.track_map.length < 2) return;
        const points = [...map.track_map, ...(map.pit_lane || [])];

        const xs = points.map(point => point.x);
        const ys = points.map(point => point.y);
        const minX = Math.min(...xs);

        const maxX = Math.max(...xs);

        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const sourceWidth = maxX - minX;
        const sourceHeight = maxY - minY;

        const width = canvas.clientWidth;
        if (width <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return;

        // The sidebar's full usable width controls the scale. Height follows the circuit aspect
        // ratio, so tracks with very different shapes neither leave unused side space nor stretch.
        const padding = 14;
        const scale = (width - padding * 2) / sourceWidth;
        const height = Math.ceil(sourceHeight * scale + padding * 2);
        canvas.style.height = `${height}px`;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.save();
        ctx.translate(padding - minX * scale, padding - minY * scale);
        ctx.scale(scale, scale);

        if (map.pit_lane?.length >= 2)
        {
            ctx.setLineDash([5 / scale, 5 / scale]);
            ctx.lineWidth = 2.5 / scale;
            ctx.strokeStyle = 'rgba(150, 155, 170, 0.75)';

            // The pit lane is packed as multiple lanes in one array, so stroke
            // each continuous segment separately to avoid a connector line.
            for (const segment of this._splitOnGaps(map.pit_lane, 30))
            {
                if (segment.length < 2) continue;
                this._traceMiniMapPath(ctx, segment, false);
                ctx.stroke();
            }

            ctx.setLineDash([]);
        }

        this._traceMiniMapPath(ctx, map.track_map, true);
        ctx.lineWidth = 9 / scale;
        ctx.strokeStyle = 'rgba(240, 241, 245, 0.12)';
        ctx.stroke();

        ctx.lineWidth = 4 / scale;
        ctx.strokeStyle = 'rgba(240, 241, 245, 0.9)';
        ctx.stroke();

        this._drawMiniMapSectors(ctx, map, scale);
        ctx.restore();
    }

    /**
     * Traces a smoothed miniature map path.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Ordered map points.
     * @param {boolean} closed Whether the path closes back to its first point.
     */
    _traceMiniMapPath(ctx, points, closed)
    {
        if (!points || points.length < 2)
        {
            return;
        }

        const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        ctx.beginPath();

        if (closed)
        {
            const start = midpoint(points[points.length - 1], points[0]);
            ctx.moveTo(start.x, start.y);

            points.forEach((point, index) =>
            {
                const next = midpoint(point, points[(index + 1) % points.length]);
                ctx.quadraticCurveTo(point.x, point.y, next.x, next.y);
            });

            ctx.closePath();
            return;
        }

        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; ++i)
        {
            const next = midpoint(points[i], points[i + 1]);
            ctx.quadraticCurveTo(points[i].x, points[i].y, next.x, next.y);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    }

    /**
     * Splits a point list wherever two consecutive points are farther apart than
     * maxGap. Used to separate the multiple pit-lane paths packed into one array.
     *
     * @param {Array<Object>} points Ordered points.
     * @param {number} maxGap Maximum allowed distance between consecutive points.
     * @returns {Array<Array<Object>>} Continuous point segments.
     */
    _splitOnGaps(points, maxGap)
    {
        const segments = [];
        let current = [points[0]];

        for (let i = 1; i < points.length; ++i)
        {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;

            if (Math.hypot(dx, dy) > maxGap)
            {
                segments.push(current);
                current = [];
            }

            current.push(points[i]);
        }

        segments.push(current);
        return segments;
    }

    /**
     * Draws a compact mark at each valid sector start.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Object} map Track map payload.
     * @param {number} scale Current source-to-canvas scale.
     */
    _drawMiniMapSectors(ctx, map, scale)
    {
        const positions = [
            map.sectors?.sector1?.position,
            map.sectors?.sector2?.position,
            map.sectors?.sector3?.position
        ];

        for (const position of positions)
        {
            if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y))
            {
                continue;
            }

            ctx.beginPath();
            ctx.arc(position.x, position.y, 3 / scale, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }
    }

    /**
     * Summarizes the circuit and the session, showing the track length only when the backend
     * reports a usable one.
     * @param {Object} session Session payload.
     * @param {Attay<Object>} standings Standings payload.
     * @returns {string} Session name and track length.
     */
    _getTrackSummary(session, standings)
    {
        let parts = [];

        if (session.name)
        {
            parts.push(session.name);
        }

        if (Number.isFinite(session.trackDistance) && session.trackDistance > 0)
        {
            parts.push(`${(session.trackDistance / 1000).toFixed(3)} km`);
        }

        if (standings && standings.length > 0)
        {
            parts.push(`󰶓 ${standings.length}`);
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
        return `<table class='grid-weather'>
            <tr>
                <td class='grid-weather-cell'>${GRID_WEATHER_GLYPHS.track}</td><td class='grid-weather-cell'><b>${StartingGridPanel.FormatReading(session.trackTemp)}°C</b></td>
                <td class='grid-weather-cell'>${GRID_WEATHER_GLYPHS.air}</td><td class='grid-weather-cell'><b>${StartingGridPanel.FormatReading(session.ambientTemp)}°C</b></td>
            </tr>
            <tr>
                <td class='grid-weather-cell'>${GRID_WEATHER_GLYPHS.rain}</td><td class='grid-weather-cell'><b>${StartingGridPanel.PercentReading(session.raining)}</b></td>
                <td class='grid-weather-cell'>${GRID_WEATHER_GLYPHS.wet}</td><td class='grid-weather-cell'><b>${StartingGridPanel.PercentReading(session.averagePathWetness)}</b></td>
            </tr>
        </table>`;
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
     * Returns the grid order, which follows the race position assigned by the session.
     * @returns {Array<Object>} Vehicles sorted by starting position.
     */
    _getGridOrder()
    {
        return [...this.standings].sort((a, b) => a.race_position - b.race_position);
    }

    /**
     * Returns the slot image for a vehicle. The car image is the one the backend supplies per car,
     * or null when the payload carries none; the logo is the manufacturer logo the head wears.
     * @param {Object} vehicle Vehicle data.
     * @param {boolean} logo True for the manufacturer logo, false for the car image.
     * @returns {?string} Image source path or URL, null when the car carries no image.
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

        let pos = vehicle.race_position_class;
        const lap = LaptimeToString(vehicle.qualy_best_lap);
        const delta = this._getLapDelta(vehicle.qualy_best_lap, best_lap_time);

        if (pos < 1)
        {
            pos = vehicle.race_position;
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
                <div class='car-tab'>
                    <span>#${HtmlEscape(vehicle.vehicle_number)}</span>
                </div>
                <img class='portrait' src='${HtmlEscape(logoImage)}' alt='${HtmlEscape(driver)} driver'/>
            </div>
            <div class='car-area'>
                <img src='${HtmlEscape(carImage)}' alt='${HtmlEscape(driver)} car'/>
                <div class='lap'>${HtmlEscape(lap)}<small>${HtmlEscape(delta)}</small></div>
                <div class='meta'>${HtmlEscape(vehicle.vehicle_name)}<span>${HtmlEscape(vehicle.vehicle_class)}</span></div>
            </div>
        </div>`;
    }

    /**
     * Flattens the field into grid rows in draw order. Each row holds the one or two cars that
     * share a pair of slots, plus the row and class labels and the class best lap those cars are
     * measured against, so the pager can slice rows into pages without re-deriving them.
     * @returns {Array<Object>} Grid rows in draw order.
     */
    _buildRows()
    {
        let rows = [];
        let field_row = 1;

        const perClass = GetByClasses(this._getGridOrder());

        perClass.forEach((value, key) =>
        {
            let best_lap_time = this._getClassBestLap(value);
            let class_row = 1;

            for (let i = 0; i < value.length; i += 2)
            {
                rows.push({
                    className: key,
                    class_row: class_row++,
                    field_row: field_row++,
                    best_lap_time: best_lap_time,
                    left: value[i],
                    right: (i + 1 < value.length) ? value[i + 1] : null
                });
            }
        });

        return rows;
    }

    /**
     * Builds the staggered pair of columns for the current page, odd positions on the left so
     * pole leads the ladder. The number of rows comes from grid_page_rows, and a class label is
     * drawn each time the page enters a new class, including at the top for context.
     * @returns {*} Virtual DOM grid node.
     */
    _buildGrid()
    {
        const rows = this._buildRows();

        this.pager.total = Math.max(1, Math.ceil(rows.length / this.pageRows));
        if (this.pager.index >= this.pager.total)
        {
            this.pager.index = 0;
        }

        const start = this.pager.index * this.pageRows;
        const page = rows.slice(start, start + this.pageRows);

        let html = '';
        let lastClass = null;

        page.forEach((row) =>
        {
            if (row.className !== lastClass)
            {
                html += `<div class='class-label ${CSSClassFromVehicleClass(row.className)}'>${HtmlEscape(row.className)}</div>`;
                lastClass = row.className;
            }

            html += `<div class='row-labels'>
                <div class='row-label row-label-class'>Row ${row.class_row}</div>
                <div class='row-label'>Row ${row.field_row}</div>
            </div>`;

            html += `<div class='grid-row'>${this._buildCard(row.left, 'left', row.best_lap_time)}`;
            if (row.right !== null)
            {
                html += this._buildCard(row.right, 'right', row.best_lap_time);
            }
            html += '</div>';
        });

        return this.vdom.h('div', { className: 'grid', htmlContent: html });
    }

    /**
     * Draws the page indicator under the grid: one dot per page with the current page filled, and
     * the current page number beside the total. Written to innerHTML like the header, since the
     * whole indicator is a flat block of markup rebuilt from scratch each time the page changes.
     */
    _renderPager()
    {
        if (!this.footer)
        {
            return;
        }

        if (this.pager.total <= 0)
        {
            this.footer.innerHTML = '';
            return;
        }

        let dots = '';

        for (let i = 0; i < this.pager.total; i++)
        {
            dots += `<span class='pager-dot${i === this.pager.index ? ' active' : ''}'></span>`;
        }

        this.footer.innerHTML = `<div class='pager-dots'>${dots}</div>`
            + this._buildPagerTimer()
            + `<span class='pager-count'>${this.pager.index + 1} / ${this.pager.total}</span>`;
    }

    /**
     * Builds the bar that drains over the time left until the page switches. The pager is
     * rewritten on every standings update, so the bar is started with a negative delay equal to
     * the time already spent on the page, which keeps it on the real timer instead of restarting.
     * The bar runs over the hold of the page on screen, so the last page counts down its longer
     * hold. It is left out when the pages do not turn.
     * @returns {string} Timer markup, or an empty string when there is no page switch to count down.
     */
    _buildPagerTimer()
    {
        const hold = this._holdTime();

        if (this.pager.total <= 1 || hold <= 0 || this.pager.timer === null)
        {
            return '';
        }

        const elapsed = Math.min(performance.now() - this.pager.started, hold);
        return `<div class='pager-timer'><span style='animation-duration: ${hold}ms; animation-delay: -${Math.round(elapsed)}ms'></span></div>`;
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
