class PitStopEstimation
{
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`PitStopEstimation: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.pitStop = null;
    }

    handleStateChange(key, value)
    {
        if (key === 'onPitStopEstimation')
        {
            this.pitStop = value;
        }
    }

    update()
    {
        if (this.pitStop == null)
        {
            return;
        }

        this.element.querySelector('.telemetry-pit-stop-estimation-driver-swap').textContent = this.pitStop.driverSwap.toFixed(1) + "s";
        this.element.querySelector('.telemetry-pit-stop-estimation-penalties').textContent = this.pitStop.penalties.toFixed(1) + "s";
        this.element.querySelector('.telemetry-pit-stop-estimation-damage').textContent = this.pitStop.damage.toFixed(1) + "s";
        this.element.querySelector('.telemetry-pit-stop-estimation-tires').textContent = this.pitStop.tires.toFixed(1) + "s";
        this.element.querySelector('.telemetry-pit-stop-estimation-fuel').textContent = this.pitStop.fuel.toFixed(1) + "s";
        this.element.querySelector('.telemetry-pit-stop-estimation-ve').textContent = this.pitStop.ve.toFixed(1) + "s";

        this.element.querySelector('.telemetry-pit-stop-estimation-total').textContent = this.pitStop.total.toFixed(1) + "s";
    }
}
