/**
 * @fileoverview Renders the pit stop estimation breakdown panel.
 */

/**
 * Displays the estimated time contribution of each pit stop service item.
 */
class PitStopEstimation
{
    /**
     * Creates a pit stop estimation panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
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

    /**
     * Stores the latest pit-stop estimation payload.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'onPitStopEstimation')
        {
            this.pitStop = value;
        }
    }

    /**
     * Refreshes the pit stop breakdown values.
     */
    update()
    {
        if (this.pitStop == null)
        {
            return;
        }

        this.element.querySelector('.pit-stop-estimation-driver-swap').textContent = this.pitStop.driverSwap.toFixed(1) + 's';
        this.element.querySelector('.pit-stop-estimation-penalties').textContent = this.pitStop.penalties.toFixed(1) + 's';
        this.element.querySelector('.pit-stop-estimation-damage').textContent = this.pitStop.damage.toFixed(1) + 's';
        this.element.querySelector('.pit-stop-estimation-tires').textContent = this.pitStop.tires.toFixed(1) + 's';
        this.element.querySelector('.pit-stop-estimation-fuel').textContent = this.pitStop.fuel.toFixed(1) + 's';
        this.element.querySelector('.pit-stop-estimation-ve').textContent = this.pitStop.ve.toFixed(1) + 's';
        this.element.querySelector('.pit-stop-estimation-total').textContent = this.pitStop.total.toFixed(1) + 's';
    }
}
