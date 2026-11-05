/**
 * @file Fullscreen live classification panel, grouped by vehicle class.
 */

/**
 * Renders the whole field as one column per vehicle class, with the live class order, the gap to
 * the class leader and a small position change marker. The panel is exclusive: while it is shown
 * no other broadcasting overlay is visible.
 */
class ClassificationPanel
{
    /**
     * Creates a classification panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`ClassificationPanel: Element ${selector} not found`);
            return;
        }

        this.body = this.element.querySelector('#classification-body');
        this.sessionLabel = this.element.querySelector('.classification-session');
        this.trackLabel = this.element.querySelector('.classification-track');
        this.countLabel = this.element.querySelector('.classification-count');
        this.clockLabel = this.element.querySelector('.classification-clock');

        this.standings = null;
        this.session = this.stateManager.getState('session');

        this.controls =
        {
            gap_mode: 'leader',
            name_source: 'driver',
            driver_name: 'short'
        };

        this.vdom = new VirtualDOM();
        this.tree = null;

        this.counter_standings_curr = 0;
        this.counter_standings_test = -1;
        this.headerDirty = true;

        this.stateManager.subscribe(this.handleStateChange.bind(this));
    }

    /**
     * Stores standings, session and control updates used by the classification renderer.
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
            this.session = value?.trackName ? value : null;
            this.headerDirty = true;
        }
        else if (key === 'overlay_controls')
        {
            this.controls = value;
        }
        else if (key === 'overlay_exclusive')
        {
            // A fresh showing starts without movement markers from the previous run.
            if (value === 'classification')
            {
                this.counter_standings_test = -1;
            }
        }
    }

    /**
     * Rebuilds the header and patches the classification when the standings snapshot changes.
     */
    update()
    {
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

            this.countLabel.textContent = '0 entries';
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
     * Whether a vehicle is out of the race.
     * @param {Object} vehicle Vehicle data.
     * @returns {number} 1 for DQ or DNF, otherwise 0, so it can be used as a sort key.
     */
    _isOut(vehicle)
    {
        return vehicle.status === 'DQ' || vehicle.status === 'DNF' ? 1 : 0;
    }

    /**
     * Formats the remaining session time as HH:MM:SS.
     * @returns {string} Clock text, empty without a session.
     */
    _getClock()
    {
        if (!this.session)
        {
            return '';
        }

        let remaining = Math.max(0, Math.floor(this.session.endEventTime - this.session.currentEventTime));
        if (!Number.isFinite(remaining)) return '';

        let h = Math.floor(remaining / 3600);
        let m = Math.floor(remaining % 3600 / 60);
        let s = remaining % 60;

        return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
    }

    /**
     * Writes the session labels and the entry count. The count is part of the header rather than
     * the class columns, so it stays accurate even when a class has no cars.
     */
    /**
     * Writes the session labels, the clock and the entry count. The count is part of the header
     * rather than the class columns, so it stays accurate even when a class has no cars.
     */
    _renderHeader()
    {
        this.headerDirty = false;

        this.trackLabel.textContent = this.session?.trackName ?? '';
        this.sessionLabel.textContent = this.session?.name ?? '';
        this.clockLabel.textContent = this._getClock();

        let total = this.standings?.length ?? 0;
        this.countLabel.textContent = `${total} ${total === 1 ? 'entry' : 'entries'}`;
    }

    /**
     * Returns a car's class position, falling back to the overall position when the backend has
     * not assigned a class position yet.
     * @param {Object} vehicle Vehicle data.
     * @returns {number} Class position, zero when neither is available.
     */
    _getClassPosition(vehicle)
    {
        return vehicle.race_position_class > 0 ? vehicle.race_position_class : vehicle.race_position;
    }

    /**
     * Returns a car's class qualy position, falling back to the overall position when the backend has
     * not assigned a class position yet.
     * @param {Object} vehicle Vehicle data.
     * @returns {number} Class qualy position, zero when neither is available.
     */
    _getClassQualyPossition(vehicle)
    {
        return vehicle.qualy_position_class > 0 ? vehicle.qualy_position_class : vehicle.qualy_position;
    }

    /**
     * Formats the gap column. The class leader reads LEADER, lapped cars keep the lap suffix the
     * shared helper produces, and everything else is shown as a positive time gap.
     * @param {Object} vehicle Vehicle data.
     * @param {number} position Class position of the vehicle.
     * @param {boolean} isRace Whether the current session is a race.
     * @returns {string} Gap text.
     */
    _formatGap(vehicle, position, isRace)
    {
        if (vehicle.status === 'DQ' || vehicle.status === 'DNF')
        {
            return vehicle.status;
        }

        if (position <= 1)
        {
            return 'LEADER';
        }

        let gap = VehicleGetGap(vehicle, this.controls, isRace);

        if (typeof gap === 'string' && gap.endsWith('L'))
        {
            return gap;
        }

        let value = Number(gap);

        return Number.isFinite(value) ? `+${value.toFixed(1)}s` : '-';
    }

    /**
     * Builds one class section. Every value taken from the payload is escaped before being
     * interpolated into the markup handed to the vdom's htmlContent attribute.
     * @param {string} className Vehicle class name.
     * @param {Array<Object>} vehicles Vehicles in that class.
     * @param {boolean} isRace Whether the current session is a race.
     * @returns {string} Class section markup.
     */
    _buildClassSection(className, vehicles, isRace)
    {
        let rows = [...vehicles].sort((a, b) => this._isOut(a) - this._isOut(b) || this._getClassPosition(a) - this._getClassPosition(b));

        let bestLap = Math.min(...vehicles.filter(v => v.best_lap > 0).map(v => v.best_lap));
        let fastestLap = Number.isFinite(bestLap) ? `<span class='classification-class-fl'>FL ${HtmlEscape(LaptimeToString(bestLap))}</span>` : '';

        let html = `<section class='classification-class ${CSSClassFromVehicleClass(className)}'>
            <header class='classification-class-head'>
                <div class='classification-class-title'>
                    <h2 class='classification-class-name'>${HtmlEscape(className)}</h2>
                    <span class='classification-class-sub'>${rows.length} ${rows.length === 1 ? 'car' : 'cars'}</span>
                </div>
                ${fastestLap}
            </header>
            <div class='classification-list'>
                <table class='classification-table'>
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th></th>
                            <th>Driver / Team</th>
                            <th>Laps</th>
                            <th>Gap</th>
                        </tr>
                    </thead>
                    <tbody>`;

        for (const vehicle of rows)
        {
            let qualy = this._getClassQualyPossition(vehicle);
            let position = this._getClassPosition(vehicle);
            let delta = qualy - position;

            let name = VehicleGetName(vehicle, this.controls);
            let team = vehicle.vehicle_name ?? '';
            let teamLine = team && team !== name ? `<span class='classification-team'>${HtmlEscape(team)}</span>` : '';
            let manufacturer = vehicle.manufacturer?.trim() || 'Default';

            let isOut = this._isOut(vehicle) === 1;
            let rowClass = ['classification-row'];

            if (position >= 1 && position <= 3)
            {
                rowClass.push(`podium-${position}`);
            }

            if (isOut) rowClass.push('out');
            else if (vehicle.in_pits) rowClass.push('pit');

            if (vehicle.focus)
            {
                rowClass.push('focus');
            }

            if (vehicle.best_lap > 0 && vehicle.best_lap === bestLap)
            {
                rowClass.push('fastest');
            }

            let movement = delta > 0 ? `\u25B2${delta}` : delta < 0 ? `\u25BC${Math.abs(delta)}` : '\u2014';
            let movementClass = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';

            html += `<tr class='${rowClass.join(' ')}'>
                <td>
                    <span class='classification-position'>${HtmlEscape(position > 0 && !isOut ? position : '-')}</span>
                    <span class='classification-movement ${movementClass}'>${movement}</span>
                </td>
                <td><img class='classification-logo' src='../shared/img/brandlogo/${HtmlEscape(manufacturer)}.png' alt='' onerror="this.onerror=null;this.src='../shared/img/brandlogo/Default.png'"/></td>
                <td>
                    <span class='classification-driver'>${HtmlEscape(name)}</span>
                    ${teamLine}
                </td>
                <td><span class='classification-laps'>${HtmlEscape(vehicle.laps ?? 0)}</span></td>
                <td><span class='classification-gap'>${HtmlEscape(this._formatGap(vehicle, position, isRace))}</span></td>
            </tr>`;
        }

        return html + `</tbody></table></div></section>`;
    }

    /**
     * Builds the full classification tree, one column per class in field order.
     * @returns {*} Virtual DOM tree.
     */
    _buildTree()
    {
        let isRace = (this.session?.name ?? '').toLowerCase().includes('race');
        let groups = GetByClasses(this.standings);
        let sections = '';

        for (const [className, vehicles] of groups)
        {
            sections += this._buildClassSection(className, vehicles, isRace);
        }

        this.countLabel.textContent = `${this.standings.length} ${this.standings.length === 1 ? 'entry' : 'entries'}`;
        let rowCount = Math.max(1, ...[...groups.values()].map(v => v.length));

        return this.vdom.h('div',
        {
            className: rowCount > 14 ? 'classification-grid dense' : 'classification-grid',
            style: `--classification-columns: ${Math.max(1, groups.size)}; --classification-rows: ${rowCount}`,
            htmlContent: sections
        });
    }
}
