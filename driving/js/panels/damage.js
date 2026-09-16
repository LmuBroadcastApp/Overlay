/**
 * @fileoverview Renders the focused vehicle's damage readout.
 */

/**
 * Displays suspension, aero, and body damage with severity-based styling.
 */
class DamagePanel
{
    /**
     * Creates a damage panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`DamagePanel: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.vehicle = null;
    }

    /**
     * Stores the focused vehicle whenever standings change.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.vehicle = StandingsGetFocus(value);
        }
    }

    /**
     * Refreshes all damage values for the current focused car.
     */
    update()
    {
        if (this.vehicle === null)
        {
            return;
        }

        this._setValue('.damage-panel-susp', this.vehicle.damage_suspension);
        this._setValue('.damage-panel-aero', this.vehicle.damage_aero);
        this._setValue('.damage-panel-body', this.vehicle.damage);
    }

    /**
     * Updates one damage field and applies the matching severity class.
     * @param {string} selector CSS selector for the target field.
     * @param {number} value Damage percentage.
     */
    _setValue(selector, value)
    {
        const el = this.element.querySelector(selector);

        el.textContent = value.toFixed(1) + "%";
        el.classList.remove('damage-ok', 'damage-warn', 'damage-crit');
        el.classList.add(value >= 50 ? 'damage-crit' : (value >= 15 ? 'damage-warn' : 'damage-ok'));
    }
}
