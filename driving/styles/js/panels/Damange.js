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
            this.vehicle = this._StandingsGetFocus(value);
        }
    }

    update()
    {
        if (this.vehicle === null)
        {
            return;
        }

        this.element.querySelector('.damage-panel-susp').textContent = this.vehicle.damage_suspension.toFixed(1) + "%";
        this.element.querySelector('.damage-panel-aero').textContent = this.vehicle.damage_aero.toFixed(1) + "%";
        this.element.querySelector('.damage-panel-body').textContent = this.vehicle.damage.toFixed(1) + "%";

    }

    _StandingsGetFocus(standings)
    {
        for (let i = 0; i < standings.length; ++i)
        {
            if (standings[i].focus)
            {
                return standings[i];
            }
        }

        return null;
    }
}
