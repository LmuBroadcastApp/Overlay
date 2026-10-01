/**
 * @fileoverview Renders the focused-car telemetry overlay with gauges and sector state.
 */

/**
 * Displays live telemetry, lap deltas, sector colors, mini sectors, and tire age.
 */
const TIRE_ICON_STATES = ['wet', 'soft', 'medium', 'hard'];
const SECTOR_STATES = ['inactive', 'green', 'yellow', 'purple'];
const LAP_STATES = ['bg-green', 'bg-yellow', 'bg-purple'];
const DELTA_STATES = ['gaining', 'losing'];
const ENERGY_STATES = ['low', 'critical'];

class TelemetryPanel
{
    /**
     * Creates a telemetry panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`TelemetryPanel: Element ${selector} not found`);
            return;
        }

        this.maxSpeed = 350;
        this.maxRpm = 13000;

        this.standings = null;
        this.vehicle = null;

        this.throttleFill = document.getElementById('throttleFill');
        this.brakeFill = document.getElementById('brakeFill');
        this.throttleValue = document.getElementById('throttleValue');
        this.brakeValue = document.getElementById('brakeValue');
        this.speedValue = document.getElementById('speedValue');
        this.rpmNumber = document.getElementById('rpmNumber');
        this.gearLabel = document.getElementById('gearLabel');

        this.lastLapTime = this.element.querySelector('.last-lap-time');
        this.gapToNext = this.element.querySelector('.gap-to-next');
        this.bestLapTime = this.element.querySelector('.best-lap-time');
        this.gapToLeader = this.element.querySelector('.gap-to-ldr');
        this.deltaValue = this.element.querySelector('.delta-value');
        this.driverName = this.element.querySelector('.telemetry-driver-name');
        this.energyLabel = this.element.querySelector('.energy-label');
        this.energyValue = this.element.querySelector('.energy-value');

        this.currentSectors = [];
        this.bestSectors = [];
        this.miniBlocks = [];

        for (let i = 1; i <= 3; i++)
        {
            this.currentSectors.push(this.element.querySelector(`.current-sector-${i}-time`));
            this.bestSectors.push(this.element.querySelector(`.best-sector-${i}-time`));
        }

        for (const container of this.element.querySelectorAll('.mini-sectors'))
        {
            this.miniBlocks.push(Array.from(container.querySelectorAll('.mini-block')));
        }

        this.speedChart = this._createGaugeChart('speedChart', '#00aaff', this.maxSpeed);
        this.rpmChart = this._createGaugeChart('rpmChart', '#00ff88', this.maxRpm);

        this.classBestMiniSectors = [];
        this.tireIconKey = null;
        this.stateManager.subscribe(this.handleStateChange.bind(this));
    }

    /**
     * Creates a doughnut gauge used for speed and RPM.
     * @param {string} canvasId Canvas element ID.
     * @param {string} color Active arc color.
     * @param {number} max Maximum gauge value.
     * @returns {Chart} Configured chart instance.
     */
    _createGaugeChart(canvasId, color, max)
    {
        return new Chart(
            document.getElementById(canvasId),
            {
                type: 'doughnut',
                data:
                {
                    datasets:
                    [{
                        data: [0, max],
                        backgroundColor: [color, 'rgba(255,255,255,0.08)'],
                        borderWidth: 0
                    }]
                },
                options:
                {
                    responsive: true,
                    maintainAspectRatio: false,
                    rotation: -135,
                    circumference: 270,
                    cutout: '75%',
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            }
        );
    }

    /**
     * Stores standings updates. Visibility is handled by ApplyPanelVisibility in main.js.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.standings = value;
            this.vehicle = value ? StandingsGetFocus(value) : null;
            this.classBestMiniSectors = this._getClassBestMiniSectors();
        }
    }

    /**
     * Toggles a single active state class on an element.
     * @param {Element|null} el Target element.
     * @param {Array<string>} states All mutually exclusive state classes.
     * @param {string} active Active class name.
     */
    _setStateClass(el, states, active)
    {
        if (!el)
        {
            return;
        }

        for (const cls of states)
        {
            el.classList.toggle(cls, cls === active);
        }
    }

    /**
     * Computes the RPM gauge color based on proximity to the rev limit.
     * @param {number} rpm Current RPM.
     * @param {number} maxRpm Gauge maximum RPM.
     * @returns {string} CSS color string.
     */
    _getRPMColor(rpm, maxRpm)
    {
        const RED = 'rgb(255, 59, 59)';
        const YELLOW = 'rgb(255, 170, 0)';
        const GREEN = 'rgb(0, 255, 136)';

        const redZone = maxRpm - maxRpm * 0.1;
        const yellowZone = maxRpm - maxRpm * 0.2;

        if (rpm > redZone) return RED;
        if (rpm > yellowZone) return YELLOW;
        return GREEN;
    }

    /**
     * Updates speed, RPM, gear, throttle, and brake widgets.
     */
    _updateGauges()
    {
        const telemetry = this.vehicle.telemetry;
        if (!telemetry)
        {
            return;
        }

        const speed = Math.min(telemetry.speed, this.maxSpeed);
        const gear = telemetry.gear;
        const rpm = telemetry.rpm;

        this.speedChart.data.datasets[0].data = [speed, this.maxSpeed - speed];
        this.rpmChart.data.datasets[0].data = [rpm, this.maxRpm - rpm];
        this.rpmChart.data.datasets[0].backgroundColor[0] = this._getRPMColor(rpm, this.maxRpm);

        this.rpmNumber.textContent = Math.round(rpm);
        this.speedValue.textContent = Math.round(speed);
        this.gearLabel.textContent = gear < 0 ? 'R' : gear === 0 ? 'N' : gear;

        /** Flash the gear label red near the rev limit as a shift indicator. */
        this.gearLabel.classList.toggle('redline', rpm > this.maxRpm * 0.9);

        this.throttleFill.style.width = (telemetry.throttle * 100) + '%';
        this.brakeFill.style.width = (telemetry.brake * 100) + '%';
        this.throttleValue.textContent = Math.round(telemetry.throttle * 100);
        this.brakeValue.textContent = Math.round(telemetry.brake * 100);

        this.speedChart.update();
        this.rpmChart.update();
    }

    /**
     * Applies the current-sector state color.
     * @param {Element} el Sector element.
     * @param {number} current Current sector time.
     * @param {number} best Personal best sector time.
     */
    _updateCurrentSector(el, current, best)
    {
        let state = 'inactive';
        if (IsValidTime(current))
        {
            state = IsValidTime(best) && current <= best ? 'green' : 'yellow';
        }
        this._setStateClass(el, SECTOR_STATES, state);
    }

    /**
     * Applies the best-sector state color.
     * @param {Element} el Sector element.
     * @param {number} sector Vehicle best sector time.
     * @param {number} best Class-best sector time.
     */
    _updateBestSector(el, sector, best)
    {
        let state = 'inactive';
        if (IsValidTime(sector))
        {
            state = best > 0 && Math.abs(best - sector) <= 0.001 ? 'purple' : 'green';
        }
        this._setStateClass(el, SECTOR_STATES, state);
    }

    /**
     * Normalizes mini-sector payloads that may be arrays or wrapped objects.
     * @param {Array<number>|{time: Array<number>}|null} group Mini-sector payload.
     * @returns {Array<number>|null} Mini-sector times.
     */
    _miniSectorTimes(group)
    {
        if (!group)
        {
            return null;
        }

        return Array.isArray(group) ? group : group.time;
    }

    /**
     * Computes class-best mini-sector times for the focused vehicle's class.
     * @returns {Array<Array<number>>} Best mini-sector times for each sector split.
     */
    _getClassBestMiniSectors()
    {
        const best =
        [
            new Array(6).fill(-1),
            new Array(6).fill(-1),
            new Array(6).fill(-1)
        ];

        if (!this.standings || !this.vehicle)
        {
            return best;
        }

        for (const v of this.standings)
        {
            if (v.vehicle_class !== this.vehicle.vehicle_class || !v.mini_sector_best)
            {
                continue;
            }

            for (let s = 0; s < 3; s++)
            {
                const times = this._miniSectorTimes(v.mini_sector_best[s]);
                if (!times)
                {
                    continue;
                }

                for (let k = 0; k < 6; k++)
                {
                    if (IsValidTime(times[k]) && (best[s][k] < 0 || times[k] < best[s][k]))
                    {
                        best[s][k] = times[k];
                    }
                }
            }
        }

        return best;
    }

    /**
     * Updates the mini-sector strip colors for the focused car.
     */
    _updateMiniSectors()
    {
        for (let s = 0; s < 3; s++)
        {
            const blocks = this.miniBlocks[s];
            const current = this._miniSectorTimes(this.vehicle.mini_sector_current[s]);

            const classBest = this.classBestMiniSectors[s];
            const ownBest = this._miniSectorTimes(this.vehicle.mini_sector_best[s]) || [];

            if (!blocks || !current)
            {
                continue;
            }

            blocks.forEach((block, k) =>
            {
                let state = 'inactive';
                const t = current[k];

                if (IsValidTime(t))
                {
                    if (IsValidTime(classBest[k]) && t <= classBest[k] + 0.001)
                    {
                        state = 'purple';
                    }
                    else if (!IsValidTime(ownBest[k]) || t < ownBest[k])
                    {
                        state = 'green';
                    }
                    else
                    {
                        state = 'yellow';
                    }
                }

                this._setStateClass(block, SECTOR_STATES, state);
            });
        }
    }

    /**
     * Updates best-lap styling based on class-best ownership.
     * @param {{lap: number|null}} bestLap Best lap descriptor for the class.
     */
    _updateBestLap(bestLap)
    {
        const isClassBest = bestLap.lap != null && Math.abs(bestLap.lap - this.vehicle.best_lap) < 0.001;
        this._setStateClass(this.bestLapTime, LAP_STATES, isClassBest ? 'bg-purple' : 'bg-green');
    }

    /**
     * Updates last-lap styling based on whether it beats the driver's best lap.
     */
    _updateLastLap()
    {
        const isNewBest = this.vehicle.last_lap <= this.vehicle.best_lap;
        this._setStateClass(this.lastLapTime, LAP_STATES, isNewBest ? 'bg-purple' : 'bg-yellow');
    }

    /**
     * Updates the live delta against the focused driver's best lap.
     */
    _updateDelta()
    {
        const delta = this.vehicle.telemetry?.delta;

        if (!Number.isFinite(delta))
        {
            this.deltaValue.textContent = '-.---';
            this._setStateClass(this.deltaValue, DELTA_STATES, '');
            return;
        }

        this.deltaValue.textContent = `${delta >= 0 ? '+' : '-'}${Math.abs(delta).toFixed(3)}`;

        const state = delta < 0 ? 'gaining' : delta > 0 ? 'losing' : '';
        this._setStateClass(this.deltaValue, DELTA_STATES, state);
    }

    /**
     * Updates tire compound and tire-age widgets.
     */
    _updateTires()
    {
        let laps = this.vehicle.laps;

        if (this.vehicle.pitstops.length > 0)
        {
            laps = laps - this.vehicle.pitstops[this.vehicle.pitstops.length - 1].lap;
            laps = Math.max(0, laps);
        }

        this.element.querySelector('.tyre-age').textContent = laps;
        this._updateTireIcon(this.element.querySelector('.tyre-icon'));
    }

    /**
     * Renders the tire compound icon: the compound letter when all four tires match, otherwise a
     * 2x2 grid of colored dots (FL FR / RL RR) like the standings tower. Only rebuilt on change.
     * @param {Element} tireIconElement Tire icon element.
     */
    _updateTireIcon(tireIconElement)
    {
        const compounds = Array.isArray(this.vehicle.tire_compound) ? this.vehicle.tire_compound.slice(0, 4) : [];
        const key = compounds.join('|');

        if (key === this.tireIconKey)
        {
            return;
        }

        this.tireIconKey = key;

        if (compounds.length === 4 && HasOneTireCompound(this.vehicle))
        {
            tireIconElement.classList.remove('mixed');
            tireIconElement.textContent = compounds[0][0];
            this._setStateClass(tireIconElement, TIRE_ICON_STATES, compounds[0].toLowerCase());
        }
        else if (compounds.length === 4)
        {
            this._setStateClass(tireIconElement, TIRE_ICON_STATES, '');
            tireIconElement.classList.add('mixed');
            tireIconElement.replaceChildren(...compounds.map(compound =>
            {
                const dot = document.createElement('span');
                dot.className = 'tyre-dot';
                dot.style.backgroundColor = TireCompoundColor(compound);
                return dot;
            }));
        }
        else
        {
            tireIconElement.classList.remove('mixed');
            tireIconElement.textContent = '-';
            this._setStateClass(tireIconElement, TIRE_ICON_STATES, '');
        }
    }

    /**
     * Updates the remaining virtual energy (%) or, for cars without it, fuel (L).
     */
    _updateEnergy()
    {
        const telemetry = this.vehicle.telemetry;
        const ve = telemetry?.ve;
        const fuel = telemetry?.fuel;
        const hasVe = Number.isFinite(ve) && ve > 0;

        if (!hasVe && !Number.isFinite(fuel))
        {
            this.energyLabel.textContent = 'NRG';
            this.energyValue.textContent = '-';
            this._setStateClass(this.energyValue, ENERGY_STATES, '');
            return;
        }

        const amount = hasVe ? ve : fuel;

        this.energyLabel.textContent = hasVe ? 'NRG' : 'FUEL';
        this.energyValue.textContent = amount.toFixed(0) + (hasVe ? '%' : 'L');

        const state = amount < 10 ? 'critical' : amount < 30 ? 'low' : '';
        this._setStateClass(this.energyValue, ENERGY_STATES, state);
    }

    /**
     * Updates timing, sector, mini-sector, and tire information.
     */
    _updateTelemetry()
    {
        const bestSectors = GetBestSectors(this.standings, this.vehicle.vehicle_class);
        const bestLap = GetBestLapTime(this.standings, this.vehicle.vehicle_class);

        this.lastLapTime.textContent = LaptimeToString(this.vehicle.last_lap);
        this.driverName.textContent = this.vehicle.driver ?? '';
        this.gapToNext.textContent = this.vehicle.delta_to_next.toFixed(3);
        this.bestLapTime.textContent = LaptimeToString(this.vehicle.best_lap);
        this.gapToLeader.textContent = this.vehicle.delta_to_class_leader.toFixed(3);

        const current = this.vehicle.current_lap_sectors;
        const best = this.vehicle.best_lap_sectors;

        for (let i = 0; i < 3; i++)
        {
            const sector = `sector${i + 1}`;

            this.currentSectors[i].textContent = Sector2String(current[sector]);
            this.bestSectors[i].textContent = Sector2String(best[sector]);

            this._updateCurrentSector(this.currentSectors[i], current[sector], best[sector]);
            this._updateBestSector(this.bestSectors[i], best[sector], bestSectors[`S${i + 1}`]);
        }

        this._updateBestLap(bestLap);
        this._updateLastLap();
        this._updateDelta();
        this._updateMiniSectors();
        this._updateTires();
        this._updateEnergy();
    }

    /**
     * Refreshes the telemetry panel for the current focused vehicle.
     */
    update()
    {
        if (this.standings == null || this.vehicle == null)
        {
            return;
        }

        this._updateTelemetry();
        this._updateGauges();
    }
}
