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
        cellRenderer: (v, vdom) => vdom.h('td', { className: 'vehicle-extra-column standings-secondary-color' }, LaptimeToString(v.best_lap))
    },
    {
        key: 'last_lap',
        headerLabel: 'LAST',
        cellRenderer: (v, vdom) => vdom.h('td', { className: 'vehicle-extra-column standings-secondary-color' }, LaptimeToString(v.last_lap))
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
            if (v.qualy_position_class == 0)
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
        this.standings_prev = null;

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
            sector_bars: false
        };
    }

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
            this.standings_prev = this.standings?.slice();
            this.counter_standings_curr++;
            this.standings = value;
        }
        else if (key === 'controls')
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

    _getGapColor(gap, position, isRace)
    {
        if (this.controls.gap_mode.toLowerCase() !== "ahead" || !isRace || position <= 1)
            return "";

        if (gap < 0.5) return "gap-less-1";
        if (gap < 2) return "gap-less-2";

        return "";
    }

    _getFirstColumnMeta(vehicle, bestLap, session)
    {
        if (!vehicle.in_pits && vehicle.telemetry.speed < 50 && session.gamePhase === 5)
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

    _getRaceFlags(vehicle)
    {
        if (vehicle.status === "Finished")
        {
            return this.vdom.h('td', null, this.vdom.h('div', null, this.vdom.h('img', { alt: 'finish-flag', height: '23', src: 'styles/img/others/flag_finish.jpg' })));
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
                this.vdom.h('img', { height: '23px', alt: '', src: `styles/img/brandlogo/${manufacturer}.png` })),
            this.vdom.h('td', { className: 'vehicle-number standings-primary-color' }, '#' + vehicle.vehicle_number),
            this.vdom.h('td', { className: `vehicle-gap standings-secondary-color ${gap_color}` }, gap),
            ...extraCells
        ];

        let raceFlag = this._getRaceFlags(vehicle);
        if (raceFlag) cells.push(raceFlag);

        cells.push(...this._getPenalties(vehicle));
        return cells;
    }

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

    _getRowClass(vehicle)
    {
        return "vehicle-" + vehicle.slot_id + (vehicle.focus ? " color-selected" : "");
    }

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
