/**
 * @file Main standings table panel for the livetiming page.
 */

/**
 * Renders the live standings table, optionally grouped by vehicle class.
 */
class StandingsPanel
{
    /** [header, width] pairs; empty width = flexible column (Driver / Team). */
    static COLUMNS =
    [
        ['#P', '2.6%'], ['#P class', '2.8%'], ['+/-', '2.4%'], ['#Vehicle', '3.2%'], ['Class', '3.2%'],
        ['Logo', '2.8%'], ['Driver', ''], ['Team', ''], ['Status', '3%'], ['Laps', '2.6%'],
        ['Current Time', '5.6%'], ['S1', '3.9%'], ['S2', '3.9%'], ['S3', '3.9%'],
        ['Last Time', '5.6%'], ['Best Time', '5.6%'], ['Best S1', '3.9%'], ['Best S2', '3.9%'], ['Best S3', '3.9%'],
        ['INT', '2.6%'], ['GAP', '2.6%'], ['Pits', '4%'], ['Tires', '2.6%'],
        ['Dmg', '3.4%'], ['Cut', '3%'], ['VE/FUEL', '3.4%'], ['', '2.6%']
    ];

    /**
     * Creates the standings panel.
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
            console.error(`StandingsPanel: Element ${selector} not found`);
            return;
        }

        this.stateHandler = this.handleStateChange.bind(this);
        this.stateManager.subscribe(this.stateHandler);

        this.standings = this.stateManager.getState('standings');
        this.sessionName = this.stateManager.getState('session')?.name ?? '';

        this.maxCutPoints = this.stateManager.getState('session')?.max_cut_points ?? 0;
        this.eventTimeRemaining = this.stateManager.getState('session')?.eventTimeRemaining ?? 0;

        this.dirty = true;
        this.splitByClass = false;
        this.checkbox = document.querySelector('#split-by-class');

        if (this.checkbox)
        {
            this.checkboxHandler = () =>
            {
                this.splitByClass = this.checkbox.checked;
                this.dirty = true;
            };

            this.checkbox.addEventListener('change', this.checkboxHandler);
            this.splitByClass = this.checkbox.checked;
        }
    }

    /**
     * Escapes text for safe interpolation into HTML markup.
     *
     * @param {*} text Raw value from the live feed.
     * @returns {string} HTML-escaped string.
     */
    static escapeHtml(text)
    {
        if (text == null) return '';

        return String(text)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    /**
     * Reacts to relevant state changes.
     *
     * @param {string} key Changed state key.
     * @param {*} value New state value.
     */
    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.standings = value;
            this.dirty = true;
        }
        else if (key === 'session')
        {
            this.eventTimeRemaining = value?.eventTimeRemaining ?? 0;
            this.maxCutPoints = value?.max_cut_points ?? 0;
            this.sessionName = value?.name ?? '';
            this.dirty = true;
        }
    }

    /**
     * Re-renders the standings when the underlying data changed.
     */
    update()
    {
        if (!this.standings || !this.dirty) return;
        this.dirty = false;

        // Class best sectors/lap, computed once per update and shared by all rows
        const bestSectorsByClass = new Map();
        const bestLapTimeByClass = new Map();

        for (const vehicle of this.standings)
        {
            if (!bestSectorsByClass.has(vehicle.vehicle_class))
            {
                bestSectorsByClass.set(vehicle.vehicle_class, GetBestSectors(this.standings, vehicle.vehicle_class));
            }

            if (!bestLapTimeByClass.has(vehicle.vehicle_class))
            {
                bestLapTimeByClass.set(vehicle.vehicle_class, GetBestLapTime(this.standings, vehicle.vehicle_class));
            }
        }

        let content = "";

        if (this.splitByClass)
        {
            for (const [vehicleClass, vehicles] of GetByClasses(this.standings))
            {
                content += this.createTable(vehicles, bestSectorsByClass, bestLapTimeByClass, vehicleClass);
            }
        }
        else
        {
            content = this.createTable(this.standings, bestSectorsByClass, bestLapTimeByClass, 'Multiclass');
        }

        this.element.innerHTML = content;
    }

    /**
     * Builds one full HTML table for the provided vehicles.
     *
     * @param {Array<Object>} vehicles Rows to render.
     * @param {Map<string, Object>} bestSectorsByClass Best sectors indexed by vehicle class.
     * @param {Map<string, number>} bestLapTimeByClass Best laptime by vehicle class.
     * @param {string} vehicleClass Vehicle class label, or empty when not splitting by class.
     * @returns {string} HTML table markup.
     */
    createTable(vehicles, bestSectorsByClass, bestLapTimeByClass, vehicleClass)
    {
        const caption = this.buildCaption(vehicleClass, vehicles);
        const header = StandingsPanel.COLUMNS.map(([title]) => `<th>${title}</th>`).join('');

        const cols = StandingsPanel.COLUMNS
            .map(([, width]) => width ? `<col style="width: ${width}">` : `<col>`)
            .join('');

        let rows = "";
        for (let i = 0; i < vehicles.length; i++)
        {
            const classSectorsBest = bestSectorsByClass.get(vehicles[i].vehicle_class);
            const classLapBest = bestLapTimeByClass.get(vehicles[i].vehicle_class);

            rows += this.createTableRow(vehicles[i], i, classSectorsBest, classLapBest);
        }

        return `<table class="standings-table">
            ${caption}
            <colgroup>${cols}</colgroup>
            <thead>
                <tr class="standings-row-color-2">${header}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    /**
     * Builds the table caption showing class, driver count with icon, and laps/remaining.
     *
     * @param {string} vehicleClass Vehicle class label, or empty when not splitting by class.
     * @param {Array<Object>} vehicles Rows for this table.
     * @returns {string} HTML caption markup.
     */
    buildCaption(vehicleClass, vehicles)
    {
        if (vehicles.length === 0)
        {
            return '';
        }

        let numLaps = '-/-';

        if (this.sessionName === 'RACE')
        {
            const raceLaps = GetTotalRaceLaps(vehicles, this.eventTimeRemaining);
            numLaps = `L${vehicles[0].laps + 1} / ${raceLaps}`;
        }

        const classSpan = vehicleClass ? `<span class="standings-caption-class">${StandingsPanel.escapeHtml(vehicleClass)}</span>` : '';
        const color = ColorFromVehicleClass(vehicleClass);

        return `<caption class="standings-caption" style="color:${color}">
            ${classSpan}
            &nbsp;&nbsp;&nbsp;&nbsp;
            <span class="standings-caption-drivers"><span class="standings-caption-icon">&#xF0D93;</span><span>${vehicles.length}</span></span>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <span class="standings-caption-laps">${numLaps}</span>
        </caption>`;
    }

    /**
     * Renders a current sector cell with delta-based coloring against the car's best sector.
     *
     * @param {number} current Current lap sector time.
     * @param {number} best Best lap sector time for the same car.
     * @returns {string} HTML table cell.
     */
    currentSectorCell(current, best)
    {
        let state = 'sector-inactive';
        if (IsValidTime(current))
        {
            state = IsValidTime(best) && current <= best ? 'sector-green' : 'sector-yellow';
        }

        return `<td class="${state}">${Sector2String(current)}</td>`;
    }

    /**
     * Renders a best time cell (sector or lap), including purple class-best highlighting.
     *
     * @param {number} time Car best time.
     * @param {number} classBest Best time in the class.
     * @param {Function} format Formatter used to render the time.
     * @returns {string} HTML table cell.
     */
    bestTimeCell(time, classBest, format)
    {
        let state = 'sector-inactive';
        if (IsValidTime(time))
        {
            state = classBest > 0 && Math.abs(classBest - time) <= 0.001 ? 'sector-purple' : 'sector-green';
        }

        return `<td class="${state}">${format(time)}</td>`;
    }

    /**
     * Renders the gained/lost positions cell against qualifying class position.
     *
     * @param {Object} value Vehicle standings row.
     * @returns {string} HTML table cell.
     */
    positionsGainedCell(value)
    {
        const qualy = value.qualy_position_class;

        if (!(qualy > 0) || !(value.race_position_class > 0))
        {
            return `<td></td>`;
        }

        const diff = qualy - value.race_position_class;

        if (diff > 0) return `<td class="position-gained">&#9650;${diff}</td>`;
        if (diff < 0) return `<td class="position-lost">&#9660;${-diff}</td>`;

        return `<td>&ndash;</td>`;
    }

    /**
     * Renders pit stop count and latest pit lane time.
     *
     * @param {Object} value Vehicle standings row.
     * @returns {string} HTML table cell.
     */
    pitStopsCell(value)
    {
        if (value.pitstops.length === 0)
        {
            return `<td></td>`;
        }

        const laptime = value.pitstops[value.pitstops.length - 1].pit_lane_time;
        const lap = value.pitstops[value.pitstops.length - 1].lap;

        return `<td>L${lap} &nbsp;&middot;&nbsp; ${laptime}s</td>`;
    }

    /**
     * Renders the tire compound shorthand for the current stint.
     *
     * @param {Object} value Vehicle standings row.
     * @returns {string} HTML table cell.
     */
    tiresCell(value)
    {
        const compounds = (value.tire_compound || []).filter(c => c);
        if (compounds.length === 0)
        {
            return `<td></td>`;
        }

        const unique = [...new Set(compounds)];

        if (unique.length === 1)
        {
            return `<td><span style="color: ${TireCompoundColor(compounds[0])}">${compounds[0].charAt(0)}</span></td>`;
        }

        return `<td style="font-size: 0.6em; line-height: 1;">
            <span style="color: ${TireCompoundColor(compounds[0])}">&#11044;</span>
            <span style="margin-left: 2px; color: ${TireCompoundColor(compounds[1])}">&#11044;</span><br/>
            <span style="color: ${TireCompoundColor(compounds[2])}">&#11044;</span>
            <span style="margin-left: 2px; color: ${TireCompoundColor(compounds[3])}">&#11044;</span>
        </td>`;
    }

    /**
     * Renders the overall vehicle damage percentage with severity coloring.
     *
     * @param {Object} value Vehicle standings row.
     * @returns {string} HTML table cell.
     */
    damageCell(value)
    {
        const damage = value.damage;
        if (damage == null)
        {
            return `<td></td>`;
        }

        const state = damage >= 50 ? 'damage-crit' : (damage >= 15 ? 'damage-warn' : 'damage-ok');
        return `<td class="${state}">${damage.toFixed(1)}%</td>`;
    }

    /**
     * Renders the accumulated track cut points, optionally against the session limit.
     *
     * @param {Object} value Vehicle standings row.
     * @returns {string} HTML table cell.
     */
    cutPointsCell(value)
    {
        const cut = value.cut_points;
        if (cut == null)
        {
            return `<td></td>`;
        }

        let state = 'cut-ok';
        let text = cut.toFixed(1);

        if (this.maxCutPoints > 0)
        {
            text += `/${this.maxCutPoints}`;
            state = cut >= (this.maxCutPoints - 1) ? 'cut-crit' : (cut >= this.maxCutPoints * 0.5 ? 'cut-warn' : 'cut-ok');
        }

        return `<td class="${state}">${text}</td>`;
    }

    /**
     * Renders remaining virtual energy (hybrid classes) or fuel with severity coloring.
     *
     * @param {Object} value Vehicle standings row.
     * @returns {string} HTML table cell.
     */
    fuelVeCell(value)
    {
        const telemetry = value.telemetry;
        const useVe = telemetry.ve > 0.0;

        const postfix = useVe ? '%' : 'L';
        const amount = useVe ? telemetry.ve : (telemetry.fuel ?? 0);

        let state = '';
        if (amount <= 15)
        {
            state = 'fuel-crit';
        }
        else if (amount <= 30)
        {
            state = 'fuel-warn';
        }

        return `<td class="${state}">${amount.toFixed(1)}${postfix}</td>`;
    }

    /**
     * Renders one standings row.
     *
     * @param {Object} value Vehicle standings row.
     * @param {number} index Row index inside the rendered table.
     * @param {{S1:number,S2:number,S3:number}} classSectorsBest Best sector times for the row class.
     * @param {number} classLapBest Best lap time for the row class.
     * @returns {string} HTML table row.
     */
    createTableRow(value, index, classSectorsBest, classLapBest)
    {
        const esc = StandingsPanel.escapeHtml;

        let int = (value.delta_to_next ?? 0).toFixed(1);
        let gap = (value.delta_to_class_leader ?? 0).toFixed(1);

        if (value.laps_behind_class_leader > 0)
        {
            gap = value.laps_behind_class_leader + "L";
        }

        let manufacturer = value.manufacturer || '';
        if (manufacturer.trim().length === 0)
        {
            manufacturer = "Default";
        }

        const driverClass = value.show_warning_icon && !value.in_pits ? ' class="show-warning-icon"' : '';
        const statusClass = value.in_pits ? ' class="vehicle-in-pits"' : '';

        const current = value.current_lap_sectors || {};
        const best = value.best_lap_sectors || {};

        const warning = value.show_warning_icon ? ' standings-row-warning' : '';
        const warningIcon = value.show_warning_icon ? `<span class="warning-icon" title="Warning">&#9888;</span>` : '';

        return `<tr class="standings-row-color-${index % 2 + 1}${warning}">
            <td>${value.race_position}</td>
            <td>${value.race_position_class}</td>
            ${this.positionsGainedCell(value)}
            <td>${esc(value.vehicle_number)}</td>
            <td style="color: ${ColorFromVehicleClass(value.vehicle_class)}">${esc(value.vehicle_class)}</td>
            <td><img alt="" width="24" src="../shared/img/brandlogo/${encodeURIComponent(manufacturer)}.png"></td>
            <td${driverClass}>${warningIcon}${esc(value.driver)}</td>
            <td>${esc(value.vehicle_name)}</td>
            <td${statusClass}>${esc(value.status)}</td>
            <td>${value.laps ?? ''}</td>
            <td>${LaptimeToString(value.current_lap)}</td>
            ${this.currentSectorCell(current.sector1, best.sector1)}
            ${this.currentSectorCell(current.sector2, best.sector2)}
            ${this.currentSectorCell(current.sector3, best.sector3)}
            <td>${LaptimeToString(value.last_lap)}</td>
            ${this.bestTimeCell(value.best_lap, classLapBest, LaptimeToString)}
            ${this.bestTimeCell(best.sector1, classSectorsBest.S1, Sector2String)}
            ${this.bestTimeCell(best.sector2, classSectorsBest.S2, Sector2String)}
            ${this.bestTimeCell(best.sector3, classSectorsBest.S3, Sector2String)}
            <td>${int}</td>
            <td>${gap}</td>
            ${this.pitStopsCell(value)}
            ${this.tiresCell(value)}
            ${this.damageCell(value)}
            ${this.cutPointsCell(value)}
            ${this.fuelVeCell(value)}
            <td>${GetPenalties(value)}</td>
        </tr>`;
    }

    /**
     * Cleans up DOM listeners and state subscriptions created by the panel.
     */
    destroy()
    {
        if (this.checkbox && this.checkboxHandler)
        {
            this.checkbox.removeEventListener('change', this.checkboxHandler);
        }

        if (this.stateHandler)
        {
            this.stateManager.unsubscribe(this.stateHandler);
        }
    }
}
