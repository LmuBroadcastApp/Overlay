/**
 * @fileoverview Generates animated mock data for the driving overlay preview mode.
 */

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

    const TRACK_DISTANCE = 4000;
    const MAP_SIZE = { width: 400, height: 300 };

    function trackPoint(t, scale = 1.0)
    {
        const a = t * 2 * Math.PI;
        const r = 1 + 0.10 * Math.sin(3 * a);

        return {
            x: MAP_SIZE.width * 0.5 + 165 * scale * r * Math.cos(a),
            y: MAP_SIZE.height * 0.5 + 100 * scale * r * Math.sin(a)
        };
    }

    function buildTrackMap()
    {
        const track_map = [];
        const pit_lane = [];

        for (let i = 0; i < 240; ++i)
        {
            track_map.push(trackPoint(i / 240));
        }

        for (let i = 0; i <= 30; ++i)
        {
            pit_lane.push(trackPoint(0.93 + (i / 30) * 0.14, 0.82));
        }

        return {
            track_map: track_map,
            pit_lane: pit_lane,
            size: MAP_SIZE,
            sectors: { sector1: 0, sector2: TRACK_DISTANCE / 3, sector3: (TRACK_DISTANCE / 3) * 2 }
        };
    }

    function makeCar(cfg)
    {
        return {
            focus: cfg.focus === true,
            is_player: cfg.is_player === true,
            vehicle_number: cfg.number,
            vehicle_class: cfg.vehicle_class,
            in_pits: cfg.in_pits === true,
            driver: cfg.driver,
            laps: cfg.laps || 0,
            last_lap: cfg.last_lap || -1,
            best_lap: cfg.best_lap || -1,
            damage: cfg.damage || 0,
            damage_aero: cfg.damage_aero || 0,
            damage_suspension: cfg.damage_suspension || 0,
            world_pos: cfg.world_pos || trackPoint(cfg.spline || 0.0),
            spline: cfg.spline || 0.0,
            pit_stops: cfg.pit_stops || 0,
            telemetry: cfg.telemetry || {},
            show_warning_icon: cfg.show_warning_icon || false,

            /** mock-internal */
            _lapTime: cfg.lapTime || 95.0,
            _progress: (cfg.laps || 0) + (cfg.spline || 0.0)
        };
    }

    function buildStandings()
    {
        return [
            makeCar({
                focus: true,
                is_player: true,
                number: '7',
                driver: 'Kamui Kobayashi',
                vehicle_class: 'Hyper',
                lapTime: 92.1,
                spline: 0.62,
                world_pos: trackPoint(0.62),
                laps: 18,
                last_lap: 92.1,
                best_lap: 91.8,
                damage: 27.5,
                damage_aero: 8.0,
                damage_suspension: 62.0,
                show_warning_icon: false,
                in_pits: false,
                telemetry: { speed: 170, gear: 5, rpm: 6500, max_rpm: 9000 }
            }),
            makeCar({
                number: '6',
                driver: 'Kevin Estre',
                vehicle_class: 'Hyper',
                lapTime: 92.6,
                spline: 0.54,
                world_pos: trackPoint(0.54),
                laps: 18,
                last_lap: 92.4,
                best_lap: 92.0,
                damage: 12.0,
                damage_aero: 5.4,
                damage_suspension: 18.0,
                show_warning_icon: false,
                in_pits: false,
                telemetry: { speed: 166, gear: 5, rpm: 6400, max_rpm: 9000 }
            }),
            makeCar({
                number: '28',
                driver: 'Oliver Rasmussen',
                vehicle_class: 'LMP2',
                lapTime: 97.4,
                spline: 0.28,
                world_pos: trackPoint(0.28),
                laps: 17,
                last_lap: 97.4,
                best_lap: 96.9,
                damage: 15.0,
                damage_aero: 7.0,
                damage_suspension: 22.0,
                show_warning_icon: false,
                in_pits: false,
                telemetry: { speed: 152, gear: 4, rpm: 6100, max_rpm: 9000 }
            }),
            makeCar({
                number: '92',
                driver: 'Michael Christensen',
                vehicle_class: 'GT3',
                lapTime: 105.1,
                spline: 0.08,
                world_pos: trackPoint(0.08),
                laps: 17,
                last_lap: 105.1,
                best_lap: 104.5,
                damage: 11.0,
                damage_aero: 4.5,
                damage_suspension: 16.0,
                show_warning_icon: true,
                in_pits: false,
                telemetry: { speed: 144, gear: 4, rpm: 5800, max_rpm: 9000 }
            })
        ];
    }

    window.addEventListener('load', () =>
    {
        const map = buildTrackMap();
        const cars = buildStandings();

        // Spread the panels so they don't overlap
        UpdateOverlaySettings(
        {
            driving_laptime_log:    { enabled: true, position_left: '20%', position_top: '22%' },
            driving_track_map:      { enabled: true, position_left: '30%', position_top: '50%' },
            driving_telemetry:      { enabled: true, position_left: '2%',  position_top: '2%'  },
            driving_weather:        { enabled: true, position_left: '45%', position_top: '2%'  },
            driving_pitstop:        { enabled: true, position_left: '2%',  position_top: '22%' },
            driving_damage:         { enabled: true, position_left: '2%',  position_top: '55%' }
        });

        stateManager.setState('map', map);
        stateManager.setState('standings', cars);

        /** Mock session clock */
        let eventTime = 1800;

        /**
         * Pit stop estimation derived from the player's current damage state.
         * @returns {Object} Pit stop estimation payload.
         */
        function mockPitStopEstimation()
        {
            const player = cars[0];
            const damage = player.damage * 0.45;
            const tires = 22.0 + Math.random() * 8.0;
            const fuel = 25.0 + Math.random() * 10.0;
            const penalties = 5.0;
            const ve = 2.0;

            return {
                driverSwap: 0.0,
                penalties: penalties,
                damage: damage,
                tires: tires,
                fuel: fuel,
                ve: ve,
                total: penalties + damage + tires + fuel + ve
            };
        }

        /**
         * Session payload with slowly evolving weather.
         * @returns {Object} Session payload.
         */
        function mockSession()
        {
            const rainCycle = (Math.sin(eventTime / 120) + 1) * 0.5;

            return {
                currentEventTime: eventTime,
                endEventTime: 7200,
                trackDistance: TRACK_DISTANCE,

                windSpeed: 12.4 + Math.sin(eventTime / 30) * 4.0,
                raining: rainCycle * 0.4,
                cloudCoverage: Math.round(2 + rainCycle * 4),

                gripLevel: 3,
                averagePathWetness: rainCycle * 0.2,

                trackTemp: 31.2 - rainCycle * 3.0,
                ambientTemp: 24.6 - rainCycle * 1.5,

                weatherForecast:
                [
                    { idx: 0.0, wind_speed: 10.0, sky: 1, rainChance: 0  },
                    { idx: 0.2, wind_speed: 12.4, sky: 2, rainChance: 10 },
                    { idx: 0.4, wind_speed: 15.0, sky: 4, rainChance: 35 },
                    { idx: 0.6, wind_speed: 18.2, sky: 6, rainChance: 65 },
                    { idx: 0.8, wind_speed: 20.5, sky: 8, rainChance: 85 },
                    { idx: 1.0, wind_speed: 16.0, sky: 3, rainChance: 20 }
                ]
            };
        }

        stateManager.setState('session', mockSession());
        stateManager.setState('pitStopEstimation', mockPitStopEstimation());

        setInterval(() =>
        {
            eventTime += 1;
            stateManager.setState('session', mockSession());
        }, 1000);

        setInterval(() =>
        {
            stateManager.setState('pitStopEstimation', mockPitStopEstimation());
        }, 5000);

        /**
         * Main animation loop: cars actually lap the circuit (time-compressed so
         * a lap only takes a few seconds), telemetry follows the track position,
         * and completed laps feed the laptime log.
         */
        const TIME_SCALE = 1;       /** 1 real second = 20 simulated seconds */
        const TICK = 1 / 60;        /** update interval in seconds */

        setInterval(() =>
        {
            for (const car of cars)
            {
                if (car.in_pits) continue;

                /** Advance along the track with a little pace noise */
                const dt = TICK * TIME_SCALE * (1 + (Math.random() - 0.5) * 0.04);
                const prevProgress = car._progress;

                car._progress += dt / car._lapTime;
                car.spline = car._progress % 1;
                car.world_pos = trackPoint(car.spline);

                /** Lap completed */
                if (Math.floor(car._progress) > Math.floor(prevProgress))
                {
                    car.laps = Math.floor(car._progress);

                    if (Math.random() < 0.15)
                    {
                        car.last_lap = -1; /** invalid lap */
                    }
                    else
                    {
                        car.last_lap = car._lapTime + (Math.random() - 0.35) * 1.2;

                        if (car.best_lap <= 0 || car.last_lap < car.best_lap)
                        {
                            car.best_lap = car.last_lap;
                        }
                    }

                    /** Damage slowly accumulates over the race */
                    car.damage = Math.min(100, car.damage + Math.random() * 1.5);
                    car.damage_aero = Math.min(100, car.damage_aero + Math.random() * 1.0);
                    car.damage_suspension = Math.min(100, car.damage_suspension + Math.random() * 2.0);
                }

                /**
                 * Telemetry is derived from the position on track so braking
                 * zones and straights stay consistent lap after lap.
                 */
                const corner = Math.sin(car.spline * 2 * Math.PI * 3);   /** 3 "corners" per lap */
                const throttle = Math.min(1, Math.max(0, corner * 1.4));
                const brake = Math.min(1, Math.max(0, -corner * 1.6));
                const speed = Math.max(60, 175 + corner * 85);

                car.telemetry =
                {
                    steering: Math.sin(car.spline * 2 * Math.PI * 5) * 0.6,
                    throttle: throttle,
                    brake: brake,
                    speed: speed,
                    gear: Math.max(2, Math.min(7, Math.floor(speed / 40))),
                    rpm: 4800 + ((speed % 40) / 40) * 4000,
                    max_rpm: 9000
                };
            }

            stateManager.setState('standings', cars.map(car => ({ ...car })));
        }, TICK);
    });
})();
