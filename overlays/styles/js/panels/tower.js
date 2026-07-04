const EXTRA_COLUMNS =
[
    {
        key: 'energy_fuel',
        headerLabel: (c) => (c.toLowerCase() === "gt3" || c.toLowerCase() === "hyper") ? "NRG" : "FUEL",
        cellRenderer: (v) => { let f = GetVehicleFuelVe(v); return `<td class="vehicle-extra-column standings-secondary-color" ${f.style}>${f.text}</td>`; }
    },
    {
        key: 'best_lap',
        headerLabel: 'BEST',
        cellRenderer: (v) => `<td class="vehicle-extra-column standings-secondary-color">${LaptimeToString(v.best_lap)}</td>` },
    {
        key: 'last_lap',
        headerLabel: 'LAST',
        cellRenderer: (v) => `<td class="vehicle-extra-column standings-secondary-color">${LaptimeToString(v.last_lap)}</td>` },
    {
        key: 'num_pit_stops',
        headerLabel: '#PITS',
        cellRenderer: (v) => `<td class="vehicle-extra-column standings-secondary-color">${v.pit_stops}</td>` },
    {
        key: 'damage',
        headerLabel: 'DMG',
        cellRenderer: (v) => `<td class="vehicle-extra-column standings-secondary-color">${v.damage.toFixed(1)}%</td>` },
    {
        key: 'pos_gain_lost',
        headerLabel: '#P',
        cellRenderer: (v) =>
        {
            let diff = v.race_position_class - v.qualy_position_class;
            let cls = diff < 0 ? "gain-position" : diff > 0 ? "lost-position" : "";
            let num = String(Math.abs(diff)).padStart(2, '0');
            let txt = (v.qualy_position_class > 0) ? (diff > 0 ? "⮟ " + num : diff < 0 ? "⮝ " + num : "-") : "-";
            return `<td class="vehicle-extra-column standings-secondary-color ${cls}">${txt}</td>`;
        }
    },
    {
        key: 'tires',
        headerLabel: 'TIRES',
        cellRenderer: (v) =>
        {
            if (HasOneTireCompound(v))
            {
                let tire = "(" + v.tire_compound[0][0] + ")";
                return `<td class="vehicle-extra-column standings-secondary-color" style="color: ${TireCompoundColor(v.tire_compound[0])};">${tire}</td>`;
            }
            return `<td class="vehicle-extra-column standings-secondary-color" style="font-size: 0.5em;">
                    <span style="color: ${TireCompoundColor(v.tire_compound[0])}"><span>
                    <span style="margin-left: 5px; color: ${TireCompoundColor(v.tire_compound[1])}"><span>
                        <br/>
                    <span style="color: ${TireCompoundColor(v.tire_compound[2])}"><span>
                    <span style="margin-left: 5px; color: ${TireCompoundColor(v.tire_compound[3])}"><span>
                </td>`;
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
        this.vehicle_control = new Map();
        this.stateManager.subscribe(this.handleStateChange.bind(this));

        this.session = null;
        this.standings = null;
        this.standings_prev = null;

        this.tree = null;
        this.vdom = new VirtualDOM();

        this.controls =
        {
            update_rate: 3,
            static_entries: 5,
            dynamic_entries: 5,
            gap_mode: "leader",
            name_source: "driver",
            driver_name: "short",
            right_column: "energy",
            vehicle_class: "multiclass",
            sector_bars: true
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
            this.standings_prev = this.standings;
            this.standings = value;
        }
        else if (key === 'controls')
        {
            this.vehicle_control.clear();
            this.controls = value;
        }
        else if (key === 'map')
        {
            this.sectors.setSectors(value.sectors.sector1, value.sectors.sector2, value.sectors.sector3)
        }
    }

    update()
    {
        if (this.standings == null || this.session == null)
        {
            if (this.tree !== null)
            {
                this.tree = null;
                this.vdom.render(this.vdom.h('div'), this.element);
            }
            return;
        }

        let newTree;
        if (this.controls.vehicle_class.toLowerCase() == "multiclass")
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

        if (this.standings && this.standings_prev)
        {
            let curr = GetByClasses(this.standings);
            let prev = GetByClasses(this.standings_prev);

            curr.forEach((value, key) =>
            {
                this._checkAndAnimateOvertakes(value, prev.get(key));
            });
        }
    }

    _getGapColor(gap, position, isRace)
    {
        if (this.controls.gap_mode.toLowerCase() != "ahead" || !isRace || position <= 1)
            return "";

        if (gap < 0.5) return "gap-less-1";
        if (gap < 2) return "gap-less-2";
        return "";
    }

    _getFirstColumnMeta(vehicle, bestLap, session)
    {
        if (!vehicle.in_pits && vehicle.telemetry.speed < 50 && session.gamePhase >= 5)
        {
            return {
                background: "style='background-color: rgb(249, 199, 79)'",
                img: "<span class='icon-container' style='color: #1a1a1a;'></span>"
            };
        }

        if (vehicle.slot_id == bestLap.id)
        {
            return {
                background: "style='background-color: #0076D7;'",
                img: "<span class='icon-container'>󰔛</span>"
            };
        }

        return { background: "", img: "" };
    }

    _getRaceFlags(vehicle)
    {
        let flag_txt = "";

        if (vehicle.in_pits && vehicle.status != "Finished" && vehicle.status != "DNF" && vehicle.status != "DQ")
        {
            flag_txt += "<td><span class='vehicle-in-pits'>PIT</span></td>";
        }

        if (vehicle.status == "Finished")
        {
            flag_txt = "<td><span><img alt='finish-flag' height='23' src='styles/img/others/flag_finish.jpg'/></span></td>";
        }

        return flag_txt;
    }

    _getPenalty(vehicle)
    {
        let penalty_txt = "";

        if (vehicle.status == "DNF" || vehicle.status == "DQ")
        {
            return "";
        }

        if (vehicle.penalties.drive_through > 0)
        {
            penalty_txt += "<span class='penalty-style'>DT</span>";
        }

        if (vehicle.penalties.stop_and_go > 0)
        {
            penalty_txt += "<span class='penalty-style'>SG</span>";
        }

        if (vehicle.penalties.time_penalty > 0)
        {
            penalty_txt += "<span class='penalty-style'>+" + vehicle.penalties.time_penalty + "</span>";
        }

        return penalty_txt == "" ? "" : `<td>${penalty_txt}</td>`;
    }

    _createRow(vehicle, position, isRace, tableRow, bestLap, extras)
    {
        let name = VehicleGetName(vehicle, this.controls, isRace);
        let gap = VehicleGetGap(vehicle, this.controls, isRace);
        let manufacturer = vehicle.manufacturer.trim() || "Default";
        let gap_color = this._getGapColor(gap, position, isRace);
        let firstCol = this._getFirstColumnMeta(vehicle, bestLap, this.session);

        if (position == 1) gap = "-";

        let sectorBars = '';
        if (this.controls.sector_bars)
        {
            let trackDistance = this.sectors.trackDistance;
            let distance = vehicle.spline * trackDistance;
            let { progress: [p1, p2, p3], active: [a1, a2, a3] } = this.sectors.getSectorProgress(distance);

            sectorBars = `<div class="sector-bars">
                <div class="sector-bar ${a1 ? '' : 'sector-bar-inactive'}"><div class="sector-bar-fill sector-bar-active" style="width: ${(p1 * 100).toFixed(1)}%;"></div></div>
                <div class="sector-bar ${a2 ? '' : 'sector-bar-inactive'}"><div class="sector-bar-fill sector-bar-active" style="width: ${(p2 * 100).toFixed(1)}%;"></div></div>
                <div class="sector-bar ${a3 ? '' : 'sector-bar-inactive'}"><div class="sector-bar-fill sector-bar-active" style="width: ${(p3 * 100).toFixed(1)}%;"></div></div>
            </div>`;
        }

        let extraCells = EXTRA_COLUMNS
            .filter(col => extras[col.key])
            .map(col => col.cellRenderer(vehicle))
            .join('');

        return `
            <td class="vehicle-icons" ${firstCol.background}">${firstCol.img}</td>
            <td class="vehicle-position standings-primary-color">${position}</td>
            <td class="vehicle-driver standings-primary-color"><span class="vehicle-driver-truncate-text">${name}</span>${sectorBars}</td>
            <td class="vehicle-logo standings-primary-color"><img height="23px" alt="" src="styles/img/brandlogo/${manufacturer}.png" /></td>
            <td class="vehicle-number standings-primary-color">#${vehicle.vehicle_number}</td>
            <td class="vehicle-gap standings-secondary-color ${gap_color}">${gap}</td>
            ${extraCells}
            ${this._getRaceFlags(vehicle)}
            ${this._getPenalty(vehicle)}`;
    }

    _renderOneStandingsClass(renderInfo)
    {
        let v = renderInfo.standings;
        let c = renderInfo.vehicle_class;
        let isRace = renderInfo.isRace;
        let gap_txt = this.controls.gap_mode.toLowerCase() == "ahead" ? "INT" : "GAP";
        let bestLap = GetBestLapTime(v);

        let headerHtml = this._buildClassHeader(c, v, gap_txt, renderInfo.extras);
        let range = this._getScrollRange(c, v, renderInfo.static_entries, renderInfo.dynamic_entries, renderInfo.update_rate);

        let rows = [];

        for (let i = range.start; i < range.end; i++)
        {
            let rowHtml = this._createRow(v[i], i + 1, isRace, 1, bestLap, renderInfo.extras);
            let cls = (v[i].focus ? "color-selected" : "") + " vehicle-" + v[i].slot_id;
            rows.push(this.vdom.h('tr', { key: v[i].slot_id, className: cls, htmlContent: rowHtml }));
        }

        if (range.scroll)
        {
            rows.push(this.vdom.h('tr', { htmlContent: "<td></td><td colspan='6' style='background-color: rgba(224, 224, 224, 0.3); height: 1px;'></td>" }));
            for (let i = range.scroll.start; i < Math.min(v.length, range.scroll.end); i++)
            {
                let rowHtml = this._createRow(v[i], i + 1, isRace, 1, bestLap, renderInfo.extras);
                let cls = (v[i].focus ? "color-selected" : "") + " vehicle-" + v[i].slot_id;
                rows.push(this.vdom.h('tr', { key: v[i].slot_id, className: cls, htmlContent: rowHtml }));
            }
        }

        return this.vdom.h('table', null,
            this.vdom.h('thead', { htmlContent: headerHtml }),
            this.vdom.h('tbody', null, rows)
        );
    }

    _buildClassHeader(c, v, gap_txt, extras)
    {
        //let race_laps = GetTotalRaceLaps(v[0], this.session.trackDistance, this.session.currentEventTime + this.session.eventTimeRemaining);
        let race_laps = GetTotalRaceLaps(v, this.session.eventTimeRemaining);
        let num_laps = `${v[0].laps + 1} / ${race_laps}`;

        let header = `<tr>
                <th></th>
                <th class="${CSSClassFromVehicleClass(c)}" colspan="4">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="margin: 0 5px auto;">󰶓  &nbsp; ${v.length}</span>
                        <span style="margin: 0 auto;">${c}</span>
                        <span style="margin-right: 5px;">${num_laps}</span>
                    </div>
                </th>
                <th class="standings-secondary-color">
                    ${gap_txt}
                </th>`;

        for (let col of EXTRA_COLUMNS)
        {
            if (extras[col.key])
            {
                let label = typeof col.headerLabel === 'function' ? col.headerLabel(c) : col.headerLabel;
                header += `<th class="standings-secondary-color">${label}</th>`;
            }
        }

        header += `</tr>`;
        return header;
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
        for (const [c, s] of GetByClasses(this.standings))
        {
            if (this.session.name == undefined)
            {
                continue;
            }

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


    _checkAndAnimateOvertakes(curr, prev)
    {
        for (let i = 0; i < Math.min(curr.length, prev.length) - 1; i++)
        {
            if (curr[i + 0].slot_id == prev[i + 1].slot_id)
            {
                let gainerRow = this.element.querySelector(`tr.vehicle-${curr[i + 0].slot_id}`);
                if (gainerRow)
                {
                    gainerRow.classList.add('overtake-gain');
                    gainerRow.addEventListener('animationend', (e) => {e.target.classList.remove('overtake-gain');});
                }

                let loserRow = this.element.querySelector(`tr.vehicle-${curr[i + 1].slot_id}`);
                if (loserRow)
                {
                    loserRow.classList.add('overtake-lost');
                    loserRow.addEventListener('animationend', (e) => { e.target.classList.remove('overtake-lost'); });
                }
            }
        }
    }
}
