/**
 * @fileoverview Renders the main standings tower for single-class and multiclass events.
 */

/**
 * Displays the live standings tower, optional extra columns, penalties, and sector bars.
 */
const EXTRA_COLUMNS =
[
    {
        key: 'energy_fuel',
        headerLabel: (c) => (c.toLowerCase() === "gt3" || c.toLowerCase() === "hyper") ? "NRG" : "FUEL",
        cellRenderer: (v, vdom) =>
        {
            let f = GetVehicleFuelVe(v);
            let colorMatch = f.style.match(/color:\s*([^"]+)/);
            let styleObj = colorMatch ? { color: colorMatch[1].trim() } : {};

            return vdom.h('td',
                { className: 'vehicle-extra-column standings-secondary-color', style: styleObj },
                f.text);
        }
    },
    {
        key: 'best_lap',
        headerLabel: 'BEST',
        cellRenderer: (v, vdom) => vdom.h('td', { className: 'vehicle-extra-column vehicle-laptime standings-secondary-color' }, LaptimeToString(v.best_lap))
    },
    {
        key: 'last_lap',
        headerLabel: 'LAST',
        cellRenderer: (v, vdom) => vdom.h('td', { className: 'vehicle-extra-column vehicle-laptime standings-secondary-color' }, LaptimeToString(v.last_lap))
    },
    {
        key: 'damage',
        headerLabel: 'DMG',
        cellRenderer: (v, vdom) => vdom.h('td', { className: 'vehicle-extra-column standings-secondary-color' }, v.damage.toFixed(1) + '%')
    },
    {
        key: 'num_pit_stops',
        headerLabel: '#PITS',
        cellRenderer: (v, vdom) =>
        {
            let lap = '';
            let time = '';

            if (v.pitstops.length > 0 && v.pitstops[v.pitstops.length - 1].session === "RACE")
            {
                lap = '\u2002\u2002L' + v.pitstops[v.pitstops.length - 1].lap;
                time = '\u2002\u2002' + LaptimeToString(v.pitstops[v.pitstops.length - 1].pit_lane_time);
            }

            return vdom.h('td', { className: 'vehicle-extra-column standings-secondary-color' }, `${v.pit_stops}${lap}${time}`);
        }
    },
    {
        key: 'pos_gain_lost',
        headerLabel: '#P',
        cellRenderer: (v, vdom) =>
        {
            if (v.qualy_position_class === 0)
            {
                return vdom.h('td', { className: 'vehicle-extra-column standings-secondary-color' }, '-');
            }

            let diff = v.race_position_class - v.qualy_position_class;
            let num = String(Math.abs(diff)).padStart(2, '0');

            let arrow = '';
            let cls = '';

            if (diff < 0)
            {
                cls = "gain-position";
                arrow = "\u2B9D";
            }
            else if (diff > 0)
            {
                cls = "lost-position";
                arrow = "\u2B9E";
            }

            return vdom.h('td', { className: 'vehicle-extra-column standings-secondary-color' },
                vdom.h('span', { className: cls }, arrow),
                ' ' + num);
        }
    },
    {
        key: 'tires',
        headerLabel: 'TIRES',
        cellRenderer: (v, vdom) =>
        {
            if (HasOneTireCompound(v))
            {
                let tire = "(" + v.tire_compound[0][0] + ")";
                return vdom.h('td',
                    { className: 'vehicle-extra-column standings-secondary-color', style: { color: TireCompoundColor(v.tire_compound[0]) } },
                    tire);
            }
            return vdom.h('td',
                { className: 'vehicle-extra-column standings-secondary-color', style: { fontSize: '0.5em' } },
                vdom.h('span', { style: { color: TireCompoundColor(v.tire_compound[0]) } }),
                vdom.h('span', { style: { marginLeft: '5px', color: TireCompoundColor(v.tire_compound[1]) } }),
                vdom.h('br'),
                vdom.h('span', { style: { color: TireCompoundColor(v.tire_compound[2]) } }),
                vdom.h('span', { style: { marginLeft: '5px', color: TireCompoundColor(v.tire_compound[3]) } }));
        }
    }
];

class TowerPanel
{
    /**
     * Creates a standings tower panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`TowerPanel: Element ${selector} not found`);
            return;
        }

        this.sectors = new TrackSectors();
        this.animation_duration = 2000;

        this.vehicle_control = new Map();
        this.stateManager.subscribe(this.handleStateChange.bind(this));

        this.session = null;
        this.standings = null;

        this.tree = null;
        this.vdom = new VirtualDOM();

        this.counter_standings_curr = 0;
        this.counter_standings_test = 0;

        this.controls =
        {
            update_rate: 3,
            static_entries: 5,
            dynamic_entries: 5,
            overtake_animation_speed: 2,
            gap_mode: "leader",
            name_source: "driver",
            driver_name: "short",
            right_column: "energy",
            vehicle_class: "multiclass",
            sector_bars: false,
            extras: []
        };
    }

    /**
     * Stores session, standings, map, and control updates used by the tower renderer.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'session')
        {
            this.session = value.trackName !== "" ? value : null;

            if (this.session == null) this.sectors.reset();
            else this.sectors.setTrackDistance(value.trackDistance);
        }
        else if (key === 'standings')
        {
            this.counter_standings_curr++;
            this.standings = value;
        }
        else if (key === 'overlay_controls')
        {
            this.controls = value;
            this.vehicle_control.clear();
            this.animation_duration = this.controls.overtake_animation_speed * 1000;
        }
        else if (key === 'map')
        {
            this.sectors.setSectors(value.sectors.sector1, value.sectors.sector2, value.sectors.sector3)
        }
    }

    /**
     * Rebuilds and patches the tower when the standings snapshot changes.
     */
    update()
    {
        if (this.standings == null || this.session == null || this.standings.length === 0)
        {
            if (this.tree !== null)
            {
                this.tree = null;
                this.vdom.render(this.vdom.h('div'), this.element);
            }

            return;
        }

        if (this.counter_standings_curr === this.counter_standings_test) return;
        this.counter_standings_test = this.counter_standings_curr

        let newTree;

        if (this.controls.vehicle_class.toLowerCase() === "multiclass")
        {
            newTree = this._buildMultiClassTree();
        }
        else
        {
            newTree = this._buildOneClassTree();
        }

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
     * Returns a gap highlight class for close battles in race mode.
     * @param {number} gap Gap value.
     * @param {number} position Vehicle position in class.
     * @param {boolean} isRace Whether the session is a race.
     * @returns {string} CSS class name or an empty string.
     */
    _getGapColor(gap, position, isRace)
    {
        if (this.controls.gap_mode.toLowerCase() !== "ahead" || !isRace || position <= 1)
            return "";

        if (gap < 0.5) return "gap-less-1";
        if (gap < 2) return "gap-less-2";

        return "";
    }

    /**
     * Resolves icon and style metadata for the tower first column.
     * @param {Object} vehicle Vehicle data.
     * @param {{id?: number}} bestLap Class-best lap descriptor.
     * @param {Object} session Session payload.
     * @returns {{style: Object|null, icon: *}} Cell style and icon descriptor.
     */
    _getFirstColumnMeta(vehicle, bestLap, session)
    {
        if (!vehicle.in_pits && vehicle.show_warning_icon && session.gamePhase === 5)
        {
            return {
                style: { backgroundColor: 'rgb(249, 199, 79)' },
                icon: this.vdom.h('span', { className: 'icon-container', style: { color: '#1a1a1a' } }, '!')
            };
        }

        if (vehicle.slot_id === bestLap.id)
        {
            return {
                style: { backgroundColor: '#0076D7' },
                icon: this.vdom.h('span', { className: 'icon-container' }, '\u{F051B}')
            };
        }

        return { style: null, icon: null };
    }

    /**
     * Builds the race-status flag cell for finished, pit, or garage states.
     * @param {Object} vehicle Vehicle data.
     * @returns {*} Virtual DOM cell or null when no special status applies.
     */
    _getRaceFlags(vehicle)
    {
        if (vehicle.status === "Finished")
        {
            return this.vdom.h('td', null, this.vdom.h('div', null, this.vdom.h('img', { alt: 'finish-flag', height: '23', src: '../shared/img/misc/flag_finish.jpg' })));
        }

        if (vehicle.status === "Request")
        {
            return this.vdom.h('td', null, this.vdom.h('div', { className: 'vehicle-in-pits' }, 'REQ'));
        }

        if (vehicle.status === "In Garage")
        {
            return this.vdom.h('td', null, this.vdom.h('div', { className: 'vehicle-in-pits' }, 'GAR'));
        }

        if (vehicle.in_pits && vehicle.status !== "DNF" && vehicle.status !== "DQ")
        {
            return this.vdom.h('td', null, this.vdom.h('div', { className: 'vehicle-in-pits' }, 'PIT'));
        }

        return null;
    }

    /**
     * Builds penalty cells for the current vehicle.
     * @param {Object} vehicle Vehicle data.
     * @returns {Array<*>} Virtual DOM table cells.
     */
    _getPenalties(vehicle)
    {
        if (vehicle.status === "DNF" || vehicle.status === "DQ")
        {
            return [];
        }

        let cells = [];

        if (vehicle.penalties.drive_through > 0)
        {
            cells.push(this.vdom.h('td', null,
                this.vdom.h('div', { className: 'penalty-style' }, 'DT')));
        }

        if (vehicle.penalties.stop_and_go > 0)
        {
            cells.push(this.vdom.h('td', null,
                this.vdom.h('div', { className: 'penalty-style' }, 'SG')));
        }

        if (vehicle.penalties.time_penalty > 0)
        {
            cells.push(this.vdom.h('td', null,
                this.vdom.h('div', { className: 'penalty-style' }, '+' + vehicle.penalties.time_penalty)));
        }

        return cells;
    }

    /**
     * Creates one standings row for a vehicle.
     * @param {Object} vehicle Vehicle data.
     * @param {number} position Vehicle position in class.
     * @param {boolean} isRace Whether the current session is a race.
     * @param {{id?: number}} bestLap Class-best lap descriptor.
     * @param {Object} extras Enabled extra columns.
     * @returns {Array<*>} Virtual DOM cells for the row.
     */
    _createRow(vehicle, position, isRace, bestLap, extras)
    {
        let name = VehicleGetName(vehicle, this.controls, isRace);
        let gap = VehicleGetGap(vehicle, this.controls, isRace);
        let manufacturer = vehicle.manufacturer.trim() || "Default";
        let gap_color = this._getGapColor(gap, position, isRace);
        let firstCol = this._getFirstColumnMeta(vehicle, bestLap, this.session);

        if (position === 1) gap = "-";

        let sectorBars = null;

        if (this.controls.sector_bars)
        {
            let trackDistance = this.sectors.trackDistance;
            let distance = vehicle.spline * trackDistance;
            let { progress: [p1, p2, p3], active: [a1, a2, a3] } = this.sectors.getSectorProgress(distance);

            sectorBars = this.vdom.h('div', { className: 'sector-bars' },
                this.vdom.h('div', { className: `sector-bar ${a1 ? '' : 'sector-bar-inactive'}` },
                    this.vdom.h('div', { className: `sector-bar-fill ${a1 ? 'sector-bar-fill-1' : ''}`, style: { width: `${(p1 * 100).toFixed(1)}%` } })),
                this.vdom.h('div', { className: `sector-bar ${a2 ? '' : 'sector-bar-inactive'}` },
                    this.vdom.h('div', { className: `sector-bar-fill ${a2 ? 'sector-bar-fill-2' : ''}`, style: { width: `${(p2 * 100).toFixed(1)}%` } })),
                this.vdom.h('div', { className: `sector-bar ${a3 ? '' : 'sector-bar-inactive'}` },
                    this.vdom.h('div', { className: `sector-bar-fill ${a3 ? 'sector-bar-fill-3' : ''}`, style: { width: `${(p3 * 100).toFixed(1)}%` } })));
        }

        let extraCells = EXTRA_COLUMNS
            .filter(col => extras[col.key])
            .map(col => col.cellRenderer(vehicle, this.vdom));

        let lastPitStop = null;

        if (this.controls.show_last_pitstop && vehicle.pitstops.length > 0 && vehicle.pitstops[vehicle.pitstops.length - 1].session === "RACE")
        {
            lastPitStop = this.vdom.h('span', { className: 'pit-stop-lap' }, 'L' + vehicle.pitstops[vehicle.pitstops.length - 1].lap);
        }

        let iconAttrs = { className: 'vehicle-icons' };
        if (firstCol.style) iconAttrs.style = firstCol.style;

        let cells = [
            this.vdom.h('td', iconAttrs, firstCol.icon),
            this.vdom.h('td', { className: 'vehicle-position standings-primary-color' }, String(position)),
            this.vdom.h('td', { className: 'vehicle-driver standings-primary-color' },
                this.vdom.h('div', { className: 'vehicle-driver-row' },
                    this.vdom.h('span', { className: 'vehicle-driver-truncate-text' }, name),
                    lastPitStop),
                sectorBars),
            this.vdom.h('td', { className: 'vehicle-logo standings-primary-color' },
                this.vdom.h('img', { height: '23px', alt: '', src: `../shared/img/brandlogo/${manufacturer}.png` })),
            this.vdom.h('td', { className: 'vehicle-number standings-primary-color' }, '#' + vehicle.vehicle_number),
            this.vdom.h('td', { className: `vehicle-gap standings-secondary-color ${gap_color}` }, gap),
            ...extraCells
        ];

        let raceFlag = this._getRaceFlags(vehicle);
        if (raceFlag) cells.push(raceFlag);

        cells.push(...this._getPenalties(vehicle));
        return cells;
    }

    /**
     * Renders a complete table for one vehicle class.
     * @param {Object} renderInfo Table rendering inputs.
     * @returns {*} Virtual DOM table node.
     */
    _renderOneStandingsClass(renderInfo)
    {
        let v = renderInfo.standings;
        let c = renderInfo.vehicle_class;

        let gap_txt = this.controls.gap_mode.toLowerCase() === "ahead" ? "INT" : "GAP";
        let bestLap = GetBestLapTime(v);

        let rows = [];
        let headerCells = this._buildClassHeader(c, v, gap_txt, renderInfo.extras);
        let range = this._getScrollRange(c, v, renderInfo.static_entries, renderInfo.dynamic_entries, renderInfo.update_rate);

        for (let i = range.start; i < range.end; i++)
        {
            let rowCells = this._createRow(v[i], i + 1, renderInfo.isRace, bestLap, renderInfo.extras);
            rows.push(this.vdom.h('tr', { key: v[i].slot_id, className: this._getRowClass(v[i]), style: this._getRowStyle(v[i]) }, rowCells));
        }

        if (range.scroll)
        {
            rows.push(this.vdom.h('tr', null,
                this.vdom.h('td', null),
                this.vdom.h('td', { colspan: '6', style: { backgroundColor: 'rgba(224, 224, 224, 0.3)', height: '1px' } })));

            for (let i = range.scroll.start; i < Math.min(v.length, range.scroll.end); i++)
            {
                let rowCells = this._createRow(v[i], i + 1, renderInfo.isRace, bestLap, renderInfo.extras);
                rows.push(this.vdom.h('tr', { key: v[i].slot_id, className: this._getRowClass(v[i]), style: this._getRowStyle(v[i]) }, rowCells));
            }
        }

        return this.vdom.h('table', null,
            this.vdom.h('thead', null, this.vdom.h('tr', null, headerCells)),
            this.vdom.h('tbody', null, rows));
    }

    /**
     * Builds the header row for one class table.
     * @param {string} c Vehicle class name.
     * @param {Array<Object>} v Class standings.
     * @param {string} gap_txt Gap column label.
     * @param {Object} extras Enabled extra columns.
     * @returns {Array<*>} Virtual DOM header cells.
     */
    _buildClassHeader(c, v, gap_txt, extras)
    {
        let race_laps = GetTotalRaceLaps(v, this.session.eventTimeRemaining);
        let num_laps = `${v[0].laps + 1} / ${race_laps}`;

        let headerCells = [
            this.vdom.h('th', null),
            this.vdom.h('th',
                { className: CSSClassFromVehicleClass(c), colspan: '4' },
                this.vdom.h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                    this.vdom.h('span', { style: { margin: '0 5px auto' } }, '\u{F0D93}\u00A0\u00A0' + v.length),
                    this.vdom.h('span', { style: { margin: '0 auto' } }, c),
                    this.vdom.h('span', { style: { marginRight: '5px' } }, num_laps))),
            this.vdom.h('th', { className: 'standings-secondary-color' }, gap_txt)
        ];

        for (let col of EXTRA_COLUMNS)
        {
            if (extras[col.key])
            {
                let label = typeof col.headerLabel === 'function' ? col.headerLabel(c) : col.headerLabel;
                headerCells.push(this.vdom.h('th', { className: 'standings-secondary-color' }, label));
            }
        }

        return headerCells;
    }

    /**
     * Computes the static and rotating portions of a long class table.
     * @param {string} c Vehicle class name.
     * @param {Array<Object>} v Class standings.
     * @param {number} static_entries Number of always-visible entries.
     * @param {number} dynamic_entries Number of rotating entries.
     * @param {number} update_rate Rotation interval in seconds.
     * @returns {{start: number, end: number, scroll?: {start: number, end: number, timestamp: number}}} Visible row ranges.
     */
    _getScrollRange(c, v, static_entries, dynamic_entries, update_rate)
    {
        if (v.length <= static_entries)
        {
            if (this.vehicle_control.has(c))
            {
                this.vehicle_control.delete(c);
            }
            return { start: 0, end: v.length };
        }

        if (!this.vehicle_control.has(c))
        {
            let opt = { start: static_entries, end: Math.min(v.length, static_entries + dynamic_entries), timestamp: new Date().getTime() };
            this.vehicle_control.set(c, opt);
        }

        let opt = this.vehicle_control.get(c);

        if (new Date().getTime() - opt.timestamp > update_rate * 1000)
        {
            let start = opt.start + 1;
            let end = opt.end + 1;

            if (end > v.length)
            {
                start = static_entries;
                end = Math.min(v.length, static_entries + dynamic_entries);
            }

            opt = { start, end, timestamp: new Date().getTime() };
            this.vehicle_control.set(c, opt);
        }

        return { start: 0, end: static_entries, scroll: opt };
    }

    /**
     * Builds the single-class tower tree.
     * @returns {*} Virtual DOM tree.
     */
    _buildOneClassTree()
    {
        let renderInfo =
        {
            extras: this.controls.extras,
            isRace: this.session.name.toLowerCase().includes("race"),

            update_rate: this.controls.update_rate,
            static_entries: this.controls.static_entries,
            dynamic_entries: this.controls.dynamic_entries,

            vehicle_class: this.controls.vehicle_class,
            standings: GetVehicleOfClass(this.standings, this.controls.vehicle_class)
        }

        return this._renderOneStandingsClass(renderInfo);
    }

    /**
     * Builds the multiclass tower tree, one table per class.
     * @returns {*} Virtual DOM tree.
     */
    _buildMultiClassTree()
    {
        let tables = [];

        if (!this.session || this.session.name === "")
        {
            return this.vdom.h('div', null, tables);
        }

        for (const [c, s] of GetByClasses(this.standings))
        {
            let renderInfo =
            {
                extras: this.controls.extras,
                isRace: this.session.name.toLowerCase().includes("race"),

                update_rate: this.controls.update_rate,
                static_entries: this.controls.static_entries,
                dynamic_entries: this.controls.dynamic_entries,

                vehicle_class: c,
                standings: s
            }

            let table = this._renderOneStandingsClass(renderInfo);
            table.key = c;
            tables.push(table);
        }

        return this.vdom.h('div', null, tables);
    }

    /**
     * Returns the CSS class for a row, including focused-car highlighting.
     * @param {Object} vehicle Vehicle data.
     * @returns {string} Row CSS class name.
     */
    _getRowClass(vehicle)
    {
        return "vehicle-" + vehicle.slot_id + (vehicle.focus ? " color-selected" : "");
    }

    /**
     * Returns the transient background highlight for overtake animations.
     * @param {Object} vehicle Vehicle data.
     * @returns {Object|null} Inline style object or null when no highlight is active.
     */
    _getRowStyle(vehicle)
    {
        if (Date.now() >= vehicle.overtake_highligh_lost_until && Date.now() >= vehicle.overtake_highligh_gain_until)
        {
            return null;
        }

        let startTime = 0;
        let color = 'rgba(0, 0, 0, 0)';

        if (vehicle.overtake_highligh_lost_until > vehicle.overtake_highligh_gain_until)
        {
            color = getComputedStyle(document.documentElement).getPropertyValue('--standings-panel-lost-position-color').trim();
            startTime = vehicle.overtake_highligh_lost_until;
        }
        else
        {
            color = getComputedStyle(document.documentElement).getPropertyValue('--standings-panel-gain-position-color').trim();
            startTime = vehicle.overtake_highligh_gain_until;
        }

        let elapsed = startTime - Date.now();
        let alpha = Math.max(0, elapsed / this.animation_duration);

        let parts = color.replace(')', '').split(',');
        parts[parts.length - 1] = ` ${alpha})`;

        return { backgroundColor: parts.join(',') };
    }
}
