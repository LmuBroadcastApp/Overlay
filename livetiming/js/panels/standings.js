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

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.standings = this.stateManager.getState('standings');
        this.maxCutPoints = this.stateManager.getState('session')?.max_cut_points ?? 0;

        this.splitByClass = false;
        this.checkbox = document.querySelector('#split-by-class');

        if (this.checkbox)
        {
            this.checkboxHandler = () => { this.splitByClass = this.checkbox.checked; };
            this.checkbox.addEventListener('change', this.checkboxHandler);
            this.splitByClass = this.checkbox.checked;
        }
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
        }
        else if (key === 'session')
        {
            this.maxCutPoints = value?.max_cut_points ?? 0;
        }
    }

    /**
     * Re-renders the standings using the latest live data.
     */
    update()
    {
        if (this.standings === null) return;

        // Class best sectors, computed once per update and shared by all rows
        const bestSectorsByClass = new Map();
        for (const vehicle of this.standings)
        {
            if (!bestSectorsByClass.has(vehicle.vehicle_class))
            {
                bestSectorsByClass.set(vehicle.vehicle_class, GetBestSectors(this.standings, vehicle.vehicle_class));
            }
        }

        let content = "";

        if (this.splitByClass)
        {
            for (const [vehicleClass, vehicles] of GetByClasses(this.standings))
            {
                const caption = `<caption style="color: ${getColorDefault(vehicleClass, "rgb(224, 224, 224)")}">${vehicleClass}</caption>`;
                content += this.createTable(vehicles, bestSectorsByClass, caption);
            }
        }
        else
        {
            content = this.createTable(this.standings, bestSectorsByClass, '');
        }

        this.element.innerHTML = content;
    }

    /**
     * Builds one full HTML table for the provided vehicles.
     *
     * @param {Array<Object>} vehicles Rows to render.
     * @param {Map<string, Object>} bestSectorsByClass Best sectors indexed by vehicle class.
     * @param {string} caption Optional table caption HTML.
     * @returns {string} HTML table markup.
     */
    createTable(vehicles, bestSectorsByClass, caption)
    {
        const header = StandingsPanel.COLUMNS.map(([title]) => `<th>${title}</th>`).join('');
        const cols = StandingsPanel.COLUMNS
            .map(([, width]) => width ? `<col style="width: ${width}">` : `<col>`)
            .join('');

        let rows = "";
        for (let i = 0; i < vehicles.length; i++)
        {
            const classBest = bestSectorsByClass.get(vehicles[i].vehicle_class);
            rows += this.createTableRow(vehicles[i], i, classBest);
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
     * Renders a best sector cell, including purple class-best highlighting.
     *
     * @param {number} sector Car best sector time.
     * @param {number} classBest Best sector time in the class.
     * @returns {string} HTML table cell.
     */
    bestSectorCell(sector, classBest)
    {
        let state = 'sector-inactive';
        if (IsValidTime(sector))
        {
            state = classBest > 0 && Math.abs(classBest - sector) <= 0.001 ? 'sector-purple' : 'sector-green';
        }

        return `<td class="${state}">${Sector2String(sector)}</td>`;
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

        return `<td>L${lap} &nbsp;&middot;&nbsp; ${laptime}</td>`;
    }

    /**
     * Renders the tire compound shorthand for the current stint.
     *
     * @param {Object} value Vehicle standings row.
     * @returns {string} HTML table cell.
     */
    tiresCell(value)
    {
        const compounds = [...new Set(value.tire_compound)].map(name => name.charAt(0));
        return `<td>${compounds.join('/')}</td>`;
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
            state = cut >= this.maxCutPoints ? 'cut-crit' : (cut >= this.maxCutPoints * 0.5 ? 'cut-warn' : 'cut-ok');
        }

        return `<td class="${state}">${text}</td>`;
    }

    /**
     * Renders one standings row.
     *
     * @param {Object} value Vehicle standings row.
     * @param {number} index Row index inside the rendered table.
     * @param {{S1:number,S2:number,S3:number}} classBest Best sector times for the row class.
     * @returns {string} HTML table row.
     */
    createTableRow(value, index, classBest)
    {
        let ve = value.telemetry.ve.toFixed(1) + "%";
        let manufacturer = value.manufacturer;

        let int = value.delta_to_next.toFixed(1);
        let gap = value.delta_to_class_leader.toFixed(1);

        if (value.laps_behind_class_leader > 0)
        {
            gap = value.laps_behind_class_leader + "L";
        }

        if (value.telemetry.ve <= 0.0)
        {
            ve = value.telemetry.fuel.toFixed(1) + "L";
        }

        if (manufacturer.trim().length === 0)
        {
            manufacturer = "Default";
        }

        let show_warning_icon = "";
        let in_pits_background = "";

        if (value.show_warning_icon && !value.in_pits)
        {
            show_warning_icon = "class='show-warning-icon'";
        }

        if (value.in_pits)
        {
            in_pits_background = "class='vehicle-in-pits'";
        }

        const current = value.current_lap_sectors || {};
        const best = value.best_lap_sectors || {};

        const warning = value.show_warning_icon ? ' standings-row-warning' : '';
        const warningIcon = value.show_warning_icon ? `<span class="warning-icon" title="Warning">&#9888;</span>` : '';

        return `<tr class="standings-row-color-${index % 2 + 1}${warning}">
            <td>${value.race_position}</td>
            <td>${value.race_position_class}</td>
            ${this.positionsGainedCell(value)}
            <td>${value.vehicle_number}</td>
            <td style="color: ${getColorDefault(value.vehicle_class, "rgb(224, 224, 224)")}">${value.vehicle_class}</td>
            <td><img alt="" width="24" src="../shared/img/brandlogo/${manufacturer}.png"</td>
            <td ${show_warning_icon}>${warningIcon}${value.driver}</td>
            <td>${value.vehicle_name}</td>
            <td ${in_pits_background}>${value.status}</td>
            <td>${value.laps ?? ''}</td>
            <td>${LaptimeToString(value.current_lap)}</td>
            ${this.currentSectorCell(current.sector1, best.sector1)}
            ${this.currentSectorCell(current.sector2, best.sector2)}
            ${this.currentSectorCell(current.sector3, best.sector3)}
            <td>${LaptimeToString(value.last_lap)}</td>
            <td>${LaptimeToString(value.best_lap)}</td>
            ${this.bestSectorCell(best.sector1, classBest.S1)}
            ${this.bestSectorCell(best.sector2, classBest.S2)}
            ${this.bestSectorCell(best.sector3, classBest.S3)}
            <td>${int}</td>
            <td>${gap}</td>
            ${this.pitStopsCell(value)}
            ${this.tiresCell(value)}
            ${this.damageCell(value)}
            ${this.cutPointsCell(value)}
            <td>${ve}</td>
            <td>${GetPenalties(value)}</td>
        </tr>`;
    }

    /**
     * Cleans up DOM listeners created by the panel.
     */
    destroy()
    {
        if (this.checkbox && this.checkboxHandler)
        {
            this.checkbox.removeEventListener('change', this.checkboxHandler);
        }
    }
}
