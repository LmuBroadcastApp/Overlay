const TIRE_ICON_STATES = ['wet', 'soft', 'medium', 'hard'];
const SECTOR_STATES = ['inactive', 'green', 'yellow', 'purple'];
const LAP_STATES = ['bg-green', 'bg-yellow', 'bg-purple'];

class TelemetryPanel
{
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
        this.speedValue = document.getElementById('speedValue');
        this.rpmNumber = document.getElementById('rpmNumber');
        this.gearLabel = document.getElementById('gearLabel');

        this.lastLapTime = this.element.querySelector('.last-lap-time');
        this.gapToNext = this.element.querySelector('.gap-to-next');
        this.bestLapTime = this.element.querySelector('.best-lap-time');
        this.gapToLeader = this.element.querySelector('.gap-to-ldr');

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
        this.stateManager.subscribe(this.handleStateChange.bind(this));
    }

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

    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.standings = value;
            this.vehicle = value ? StandingsGetFocus(value) : null;
            this.classBestMiniSectors = this._getClassBestMiniSectors();
        }
        else if (key === 'overlay_controls')
        {
            this.element.style.visibility = value.show_telemetry ? 'visible' : 'hidden';
        }
    }

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

        this.throttleFill.style.width = (telemetry.throttle * 100) + '%';
        this.brakeFill.style.width = (telemetry.brake * 100) + '%';

        this.speedChart.update();
        this.rpmChart.update();
    }

    _updateCurrentSector(el, current, best)
    {
        let state = 'inactive';
        if (IsValidTime(current))
        {
            state = IsValidTime(best) && current <= best ? 'green' : 'yellow';
        }
        this._setStateClass(el, SECTOR_STATES, state);
    }

    _updateBestSector(el, sector, best)
    {
        let state = 'inactive';
        if (IsValidTime(sector))
        {
            state = best > 0 && Math.abs(best - sector) <= 0.001 ? 'purple' : 'green';
        }
        this._setStateClass(el, SECTOR_STATES, state);
    }

    /** The feed may deliver mini sector groups either as a plain array or as { time: [...] }. */
    _miniSectorTimes(group)
    {
        if (!group)
        {
            return null;
        }

        return Array.isArray(group) ? group : group.time;
    }

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

    _updateBestLap(bestLap)
    {
        const isClassBest = bestLap.lap != null && Math.abs(bestLap.lap - this.vehicle.best_lap) < 0.001;
        this._setStateClass(this.bestLapTime, LAP_STATES, isClassBest ? 'bg-purple' : 'bg-green');
    }

    _updateLastLap()
    {
        const isNewBest = this.vehicle.last_lap <= this.vehicle.best_lap;
        this._setStateClass(this.lastLapTime, LAP_STATES, isNewBest ? 'bg-purple' : 'bg-yellow');
    }

    _updateTires()
    {
        let sameTireCompound = HasOneTireCompound(this.vehicle);
        let laps = this.vehicle.laps;

        if (this.vehicle.pitstops.length > 0)
        {
            laps = laps - this.vehicle.pitstops[this.vehicle.pitstops.length - 1].lap;
            laps = Math.max(0, laps);
        }

        this.element.querySelector('.tyre-age').textContent = laps;
        let tireIconElement = this.element.querySelector('.tyre-icon');

        if (sameTireCompound)
        {
            tireIconElement.textContent = this.vehicle.tire_compound[0][0];
            this._setStateClass(tireIconElement, TIRE_ICON_STATES, this.vehicle.tire_compound[0].toLowerCase());
        }
        else
        {
            tireIconElement.textContent = '-';
            this._setStateClass(tireIconElement, TIRE_ICON_STATES, 'undefined');
        }
    }

    _updateTelemetry()
    {
        const bestSectors = GetBestSectors(this.standings, this.vehicle.vehicle_class);
        const bestLap = GetBestLapTime(this.standings, this.vehicle.vehicle_class);

        this.lastLapTime.textContent = LaptimeToString(this.vehicle.last_lap);
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
        this._updateMiniSectors();
        this._updateTires();
    }

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
