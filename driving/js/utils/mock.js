/**
 * Mock data provider for local styling / preview.
 * Activate by opening the page with "?mock" in the URL, e.g. index.html?mock
 */
(function ()
{
    if (!window.location.search.includes('mock'))
    {
        return;
    }

    window.MOCK_MODE = true;

    window.addEventListener('load', () =>
    {
        // Spread the panels so they don't overlap
        UpdateOverlaySettings(
        {
            driving_telemetry: { position_left: '2%',  position_top: '2%'  },
            driving_weather:   { position_left: '45%', position_top: '2%'  },
            driving_pitstop:   { position_left: '2%',  position_top: '22%' },
            driving_damage:    { position_left: '2%',  position_top: '55%' },
            driving_laptime_log: { position_left: '20%', position_top: '22%' }
        });

        stateManager.setState('onPitStopEstimation',
        {
            driverSwap: 0.0,
            penalties: 5.0,
            damage: 12.3,
            tires: 26.0,
            fuel: 31.4,
            ve: 2.0,
            total: 48.7
        });

        stateManager.setState('session',
        {
            currentEventTime: 1800,
            endEventTime: 7200,

            windSpeed: 12.4,
            raining: 0.15,
            cloudCoverage: 2,

            gripLevel: 3,
            averagePathWetness: 0.07,

            trackTemp: 31.2,
            ambientTemp: 24.6,

            weatherForecast:
            [
                { idx: 0.0, wind_speed: 10.0, sky: 1, rainChance: 0  },
                { idx: 0.2, wind_speed: 12.4, sky: 2, rainChance: 10 },
                { idx: 0.4, wind_speed: 15.0, sky: 4, rainChance: 35 },
                { idx: 0.6, wind_speed: 18.2, sky: 6, rainChance: 65 },
                { idx: 0.8, wind_speed: 20.5, sky: 8, rainChance: 85 },
                { idx: 1.0, wind_speed: 16.0, sky: 3, rainChance: 20 }
            ]
        });

        // Animated telemetry so the chart, bars and steering wheel move
        let t = 0;

        // Simulated lap counter: a new "lap" completes every 3 seconds
        let laps = 0;
        let lastLap = 0;
        let bestMockLap = Infinity;

        setInterval(() =>
        {
            laps++;

            if (Math.random() < 0.2)
            {
                lastLap = -1; /** invalid lap */
            }
            else
            {
                lastLap = 91.5 + Math.random() * 1.2;
                bestMockLap = Math.min(bestMockLap, lastLap);
            }
        }, 3000);

        setInterval(() =>
        {
            t += 0.05;

            const cycle = Math.sin(t);
            const throttle = Math.min(1, Math.max(0, cycle * 1.4));
            const brake = Math.min(1, Math.max(0, -cycle * 1.6));
            const steering = Math.sin(t * 0.7) * 0.6;

            const speed = 160 + cycle * 80;
            const gear = Math.max(2, Math.min(6, Math.floor(speed / 45)));
            const rpm = 5000 + ((speed % 45) / 45) * 3800;

            stateManager.setState('standings',
            [{
                focus: true,

                laps: laps,
                last_lap: lastLap,
                best_lap: bestMockLap === Infinity ? -1 : bestMockLap,

                damage: 27.5,             /** warn (yellow)  */
                damage_aero: 8.0,         /** ok (green)     */
                damage_suspension: 62.0,  /** crit (red)     */

                telemetry:
                {
                    steering: steering,
                    throttle: throttle,
                    brake: brake,

                    speed: speed,
                    gear: gear,

                    rpm: rpm,
                    max_rpm: 9000
                }
            }]);
        }, 50);
    });
})();
