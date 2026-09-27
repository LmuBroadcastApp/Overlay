/** @brief How many grid rows to draw. A full field is far taller than the overlay window. */
const STARTING_GRID_MAX_ROWS = 3;

/** @brief Total sweep time in milliseconds, used when the stylesheet defines no duration. */
const STARTING_GRID_SCROLL_FALLBACK = 40000;

/** @brief Wait before the sweep in milliseconds, used when the stylesheet defines no delay. */
const STARTING_GRID_SCROLL_DELAY_FALLBACK = 0;

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

        this.tree = null;
        this.vdom = new VirtualDOM();

        this.counter_standings_curr = 0;
        this.counter_standings_test = 0;

        this.standings = null;

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
     * Stores standings and control updates used by the grid renderer.
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
     * animation frame, see _animateScroll.
     */
    _beginScroll()
    {
        if (this.tree === null) return;

        this.scroll.pending = false;
        this.scroll.duration = this._scrollTime('--starting-grid-scroll-duration', STARTING_GRID_SCROLL_FALLBACK);
        this.scroll.delay = this._scrollTime('--starting-grid-scroll-delay', STARTING_GRID_SCROLL_DELAY_FALLBACK);
        this.scroll.start = 0;
        this.scroll.active = this.scroll.duration > 0;

        this.element.scrollTop = 0;
        this._animateScroll();
    }

    /**
     * Walks the panel from the top to the bottom over the configured duration, after the
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
        this.element.scrollTop = Math.max(0, this.element.scrollHeight - this.element.clientHeight) * progress;
        this.scroll.active = progress < 1;

        if (this.scroll.active) requestAnimationFrame((timestamp) => this._animateScroll(timestamp));
    }

    /**
     * Rebuilds and patches the grid when the standings snapshot changes or the shown page advances.
     */
    update()
    {
        if (this.scroll.pending)
        {
            this._beginScroll();
        }

        if (this.standings == null || this.standings.length === 0)
        {
            if (this.tree !== null)
            {
                this.tree = null;
                this.vdom.render(this.vdom.h('div'), this.element);
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
            this.tree = this.vdom.render(newTree, this.element);
        }
        else
        {
            this.tree = this.vdom.patch(this.tree, newTree, this.element);
        }
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
            if (image) return `http://localhost:6397/start/images/cars/${image}_frontAngle.webp`;
        }

        let manufacturer = vehicle.manufacturer?.trim() || 'Default';
        return `../shared/img/brandlogo/${manufacturer}.png`;
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
        let delta = (vehicle.qualy_best_lap - best_lap_time).toFixed(3);

        if (pos < 1)
        {
            pos = vehicle.qualy_position;
        }

        if (delta < 0.001)
        {
            delta = 'Pole position';
        }
        else
        {
            delta = '+' + delta;
        }

        return `<div class='driver-card ${side} ${CSSClassFromVehicleClass(vehicle.vehicle_class)}'>
            <div class='driver-head'>
                <div class='card-number'>${HtmlEscape(pos)}</div>
                <div class='driver-name'>
                    <small>${HtmlEscape(name.first)}</small>
                    <strong>${HtmlEscape(name.last)}</strong>
                </div>
                <div class='team-badge'></div>
                <img class='portrait' src='${HtmlEscape(StartingGridPanel.GetSlotImage(vehicle, true))}' alt='${HtmlEscape(driver)} driver'/>
            </div>
            <div class='car-area'>
                <img src='${HtmlEscape(StartingGridPanel.GetSlotImage(vehicle, false))}' alt='${HtmlEscape(driver)} car'/>
                <div class='lap'>${HtmlEscape(lap)}<small>${delta}</small></div>
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
        let order = this._getGridOrder();
        const perClass = GetByClasses(order);

        perClass.forEach((value, key) =>
        {
            let best_lap_time = value[0].qualy_best_lap;
            let row = 1;

            for (let i = 0; i < value.length; i += 2)
            {
                html += `<div class='row-label'>Row ${row++}</div>`;
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
