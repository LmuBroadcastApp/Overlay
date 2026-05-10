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

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.vehicle = null; this.controls = null;

        this.throttleFill = document.getElementById('throttleFill');
        this.brakeFill = document.getElementById('brakeFill');

        this.speedValue = document.getElementById('speedValue');
        this.rpmNumber = document.getElementById("rpmNumber");
        this.gearLabel = document.getElementById('gearLabel');

        this.speedChart = new Chart(
            document.getElementById('speedChart'),
            {
                type: 'doughnut',
                data:
                {
                    datasets:
                    [{
                        data: [0, 350],
                        backgroundColor: ['#00aaff', 'rgba(255,255,255,0.08)'],
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

        this.rpmChart = new Chart(
            document.getElementById('rpmChart'),
            {
                type: 'doughnut',
                data:
                {
                    datasets:
                    [{
                        data: [0, 13000],
                        backgroundColor: ['#00ff88', 'rgba(255,255,255,0.08)'],
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
            this.vehicle = StandingsGetFocus(value);
        }

        if (key == 'controls')
        {
            this.element.style.visibility = value.show_telemetry ? 'visible' : 'hidden';
        }
    }

    getRPMColor(rpm, maxRpm)
    {
        const YELLOW = { r: 255, g: 170, b: 0 };
        const GREEN = { r: 0, g: 255, b: 136 };
        const RED = { r: 255, g: 59, b: 59 };

        const t2 = maxRpm - maxRpm * 0.1;
        const t1 = maxRpm - maxRpm * 0.2;

        if (rpm > t2)
        {
            return `rgb(${RED.r}, ${RED.g}, ${RED.b})`;
        }

        if (rpm > t1)
        {
            return `rgb(${YELLOW.r}, ${YELLOW.g}, ${YELLOW.b})`;
        }

        return `rgb(${GREEN.r}, ${GREEN.g}, ${GREEN.b})`;
    }

    updateHUD(speed, throttle, brake, gear, rpm, max_rpm)
    {
        this.speedChart.data.datasets[0].data =
        [
            speed,
            350 - speed
        ];

        this.rpmChart.data.datasets[0].data =
        [
            rpm,
            max_rpm - rpm
        ];

        this.rpmChart.data.datasets[0].backgroundColor[0] =  this.getRPMColor(rpm, max_rpm);

        this.rpmNumber.textContent = Math.round(rpm);
        this.speedValue.textContent = Math.round(speed);
        this.gearLabel.textContent = gear < 0 ? 'R' : gear == 0 ? 'N' : gear;

        this.throttleFill.style.width = (throttle * 100) + '%';
        this.brakeFill.style.width = (brake * 100) + '%';

        this.speedChart.update();
        this.rpmChart.update();
    }

    update()
    {
        if (this.vehicle == null)
        {
            return;
        }

        let throttle = this.vehicle.telemetry.throttle;
        let max_rpm = this.vehicle.telemetry.max_rpm;
        let speed = this.vehicle.telemetry.speed;
        let brake = this.vehicle.telemetry.brake;
        let gear = this.vehicle.telemetry.gear;
        let rpm = this.vehicle.telemetry.rpm;

        this.updateHUD(speed, throttle, brake, gear, rpm, max_rpm);
    }
}
