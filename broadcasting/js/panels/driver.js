class DriverPanel
{
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`DriverPanel: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.vehicle = null;
        this.standings = null;

        const speedValue = document.getElementById('speedValue');
        const gearLabel = document.getElementById('gearLabel');
        const throttleFill = document.getElementById('throttleFill');
        const brakeFill = document.getElementById('brakeFill');
    }

    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.vehicle = StandingsGetFocus(value);
            this.standings = value;
        }
    }

    update()
    {
        if (this.vehicle == null)
        {
            return;
        }

        let diff_pos = this.vehicle.race_position_class - this.vehicle.qualy_position_class;
        let diff_pos_txt = "-";

        if (this.vehicle.qualy_position_class > 0 && diff_pos != 0)
        {
            diff_pos_txt = diff_pos > 0 ? "⮟ " + Math.abs(diff_pos) : "⮝ " + Math.abs(diff_pos);
            diff_pos_txt += "&nbsp;&nbsp;&nbsp;Q" + this.vehicle.qualy_position_class;
        }

        this.element.querySelector('.driver-panel-name').textContent = this.vehicle.driver;
        this.element.querySelector('.driver-panel-team').textContent = this.vehicle.vehicle_name;
        this.element.querySelector('.driver-panel-pos-diff').innerHTML = diff_pos_txt;

        this.element.querySelector('.driver-panel-last-lap').textContent = LaptimeToString(this.vehicle.last_lap);

        let bestLapEl = this.element.querySelector('.driver-panel-best-lap');
        bestLapEl.textContent = LaptimeToString(this.vehicle.best_lap);
        bestLapEl.classList.toggle('best-lap-class-leader', this.isClassBestLap());

        this.element.querySelector('.vehicle-class-name').textContent = this.vehicle.vehicle_class;
        this.element.querySelector('.driver-vehicle-number').textContent = "#" + this.vehicle.vehicle_number;

        this.element.querySelector('.driver-vehicle-position').textContent = "P" + this.vehicle.race_position_class;
        this.element.querySelector('.driver-vehicle-number').style.backgroundColor = ColorFromVehicleClass(this.vehicle.vehicle_class);

        this.updateVeCell();
    }

    updateVeCell()
    {
        let cell = document.getElementById('veCell');
        let telemetry = this.vehicle.telemetry;

        if (!cell || !telemetry)
        {
            return;
        }

        let txt = "";
        let color = "";

        if (telemetry.ve > 0)
        {
            txt = telemetry.ve.toFixed(0) + "%";
        }
        else
        {
            txt = telemetry.fuel.toFixed(0) + "L";
        }

        let amount = telemetry.ve > 0 ? telemetry.ve : telemetry.fuel;

        if (amount < 10)
        {
            color = "rgb(249, 87, 56)";
        }
        else if (amount < 30)
        {
            color = "rgb(244, 211, 94)";
        }

        cell.textContent = txt;
        cell.style.color = color || "";
    }

    isClassBestLap()
    {
        if (this.standings == null || this.vehicle.best_lap <= 0)
        {
            return false;
        }

        for (const v of this.standings)
        {
            if (v.vehicle_class === this.vehicle.vehicle_class && v.best_lap > 0 && v.best_lap < this.vehicle.best_lap)
            {
                return false;
            }
        }

        return true;
    }
}
