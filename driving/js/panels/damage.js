class DamagePanel
{
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

    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.vehicle = StandingsGetFocus(value);
        }
    }

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

    _setValue(selector, value)
    {
        const el = this.element.querySelector(selector);

        el.textContent = value.toFixed(1) + "%";
        el.classList.remove('damage-ok', 'damage-warn', 'damage-crit');
        el.classList.add(value >= 50 ? 'damage-crit' : (value >= 15 ? 'damage-warn' : 'damage-ok'));
    }
}
