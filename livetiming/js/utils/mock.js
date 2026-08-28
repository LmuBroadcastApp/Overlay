/**
 * @file Mock data provider for local styling and preview of the livetiming page.
 */
(function ()
{
    if (!window.location.search.includes('mock'))
    {
        return;
    }

    window.MOCK_MODE = true;

    const MAP_SIZE = { width: 400, height: 300 };

    /** Point on a slightly wobbly ellipse so the map looks like a circuit. */
    /**
     * Returns a point on a slightly wobbly ellipse so the generated map resembles a circuit.
     *
     * @param {number} t Normalized lap position in the [0, 1] range.
     * @param {number} scale Optional scale multiplier.
     * @returns {{x:number,y:number}} 2D world position.
     */
    function trackPoint(t, scale = 1.0)
    {
        const a = t * 2 * Math.PI;
        const r = 1 + 0.10 * Math.sin(3 * a);

        return {
            x: MAP_SIZE.width  * 0.5 + 165 * scale * r * Math.cos(a),
            y: MAP_SIZE.height * 0.5 + 100 * scale * r * Math.sin(a)
        };
    }

    /**
     * Builds a procedural track map and pit lane path for mock mode.
     *
     * @returns {{track_map:Array<Object>, pit_lane:Array<Object>, size:{width:number,height:number}}}
     * Mock track map payload.
     */
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
            size: MAP_SIZE
        };
    }

    /**
     * Builds the mock session payload.
     *
     * @param {number} currentEventTime Current session clock in seconds.
     * @returns {Object} Mock session payload.
     */
    function mockSession(currentEventTime)
    {
        return {
            name: 'RACE',
            trackName: 'Circuit de la Sarthe',
            currentEventTime: currentEventTime,
            endEventTime: 7200,
            sectorFlags: [false, false, false],
            trackTemp: 31.2,
            ambientTemp: 24.6,
            raining: 0.0,
            averagePathWetness: 0.0,
            cloudCoverage: 2,
            weatherForecast:
            [
                { idx: 0.00, sky: 1, rainChance:  0, wind_speed:  8 },
                { idx: 0.20, sky: 2, rainChance:  5, wind_speed: 10 },
                { idx: 0.35, sky: 4, rainChance: 20, wind_speed: 14 },
                { idx: 0.50, sky: 6, rainChance: 45, wind_speed: 18 },
                { idx: 0.65, sky: 8, rainChance: 70, wind_speed: 22 },
                { idx: 0.85, sky: 3, rainChance: 10, wind_speed: 12 },
                { idx: 1.00, sky: 1, rainChance:  0, wind_speed:  8 }
            ]
        };
    }

    /**
     * Builds one mock standings entry.
     *
     * @param {Object} cfg Vehicle configuration.
     * @returns {Object} Mock vehicle row.
     */
    function makeCar(cfg)
    {
        return {
            race_position: 0,
            race_position_class: 0,
            vehicle_number: cfg.number,
            vehicle_class: cfg.vehicle_class,
            manufacturer: cfg.manufacturer,
            driver: cfg.driver,
            vehicle_name: cfg.team,
            status: cfg.status || '',
            in_pits: cfg.in_pits === true,
            show_warning_icon: cfg.warning === true,
            laps: cfg.laps || 0,
            qualy_position_class: cfg.qualy_position_class || 0,
            pit_stops: cfg.pit_stops || 0,
            pitstops: cfg.pitstops || [],
            tire_compound: cfg.tires || ['Medium', 'Medium', 'Medium', 'Medium'],
            current_lap: 0,
            last_lap: -1,
            best_lap: cfg.lapTime,
            delta_to_next: 0,
            delta_to_class_leader: 0,
            laps_behind_class_leader: 0,
            current_lap_sectors: { sector1: -1, sector2: -1, sector3: -1 },
            best_lap_sectors:
            {
                sector1: cfg.lapTime * 0.31,
                sector2: cfg.lapTime * 0.35,
                sector3: cfg.lapTime * 0.34
            },
            telemetry:
            {
                speed: 0,
                ve: cfg.ve || 0,
                fuel: cfg.fuel || 0
            },
            penalties: { drive_through: 0, stop_and_go: 0, time_penalty: cfg.time_penalty || 0 },
            spline: cfg.spline,
            world_pos: trackPoint(cfg.in_pits === true ? 0.97 : cfg.spline, cfg.in_pits === true ? 0.82 : 1.0),
            _lapTime: cfg.lapTime,
            _progress: cfg.spline
        };
    }

    /**
     * Creates the mock multi-class field shown in preview mode.
     *
     * @returns {Array<Object>} Mock standings rows.
     */
    function buildField()
    {
        return [
            makeCar({ number: '7',  driver: 'Kamui Kobayashi',   team: 'Toyota Gazoo Racing',       vehicle_class: 'Hyper', manufacturer: 'Toyota',   lapTime: 92.1,  spline: 0.62, ve: 68, laps: 19, qualy_position_class: 2 }),
            makeCar({ number: '6',  driver: 'Kevin Estre',       team: 'Porsche Penske Motorsport', vehicle_class: 'Hyper', manufacturer: 'Porsche',  lapTime: 92.4,  spline: 0.58, ve: 55, laps: 19, qualy_position_class: 1, pit_stops: 1, pitstops: [{ session: 'RACE', lap: 8, pit_lane_time: 52.4 }] }),
            makeCar({ number: '50', driver: 'Antonio Fuoco',     team: 'Ferrari AF Corse',          vehicle_class: 'Hyper', manufacturer: 'Ferrari',  lapTime: 92.8,  spline: 0.51, ve: 41, laps: 19, qualy_position_class: 3, time_penalty: 5, warning: true, tires: ['Soft', 'Soft', 'Medium', 'Medium'] }),
            makeCar({ number: '22', driver: 'Filipe Albuquerque', team: 'United Autosports',        vehicle_class: 'LMP2',  manufacturer: 'Oreca',    lapTime: 97.0,  spline: 0.31, fuel: 48, laps: 18, qualy_position_class: 2 }),
            makeCar({ number: '28', driver: 'Oliver Rasmussen',  team: 'IDEC Sport',                vehicle_class: 'LMP2',  manufacturer: 'Oreca',    lapTime: 97.4,  spline: 0.28, fuel: 27, laps: 18, qualy_position_class: 1, pit_stops: 2, pitstops: [{ session: 'RACE', lap: 6, pit_lane_time: 55.1 }, { session: 'RACE', lap: 13, pit_lane_time: 49.8 }] }),
            makeCar({ number: '35', driver: 'Paul-Loup Chatin',  team: 'Alpine Endurance Team',     vehicle_class: 'LMP2',  manufacturer: 'Alpine',   lapTime: 98.1,  spline: 0.15, fuel: 52, laps: 17, qualy_position_class: 3, in_pits: true, status: 'PIT', pit_stops: 1, pitstops: [{ session: 'RACE', lap: 17, pit_lane_time: 61.2 }], tires: ['Wet', 'Wet', 'Wet', 'Wet'] }),
            makeCar({ number: '92', driver: 'Michael Christensen', team: 'Manthey EMA',             vehicle_class: 'GT3',   manufacturer: 'Porsche',  lapTime: 105.0, spline: 0.080, ve: 61, laps: 17, qualy_position_class: 2 }),
            makeCar({ number: '81', driver: 'Charlie Eastwood',  team: 'TF Sport',                  vehicle_class: 'GT3',   manufacturer: 'Corvette', lapTime: 105.2, spline: 0.086, ve: 44, laps: 17, qualy_position_class: 1 })
        ];
    }

    window.addEventListener('load', () =>
    {
        const cars = buildField();
        let eventTime = 1800;
        let t = 0;

        stateManager.setState('session', mockSession(eventTime));
        stateManager.setState('standings', cars);
        stateManager.setState('map', buildTrackMap());

        setInterval(() =>
        {
            eventTime += 1;
            const yellowSector = Math.floor(eventTime / 15) % 3;
            const session = mockSession(eventTime);
            session.sectorFlags[yellowSector] = (Math.floor(eventTime / 15) % 2) === 1;
            session.raining = (Math.sin(eventTime / 120) + 1) * 5;
            session.averagePathWetness = (Math.sin(eventTime / 180) + 1) * 3;
            stateManager.setState('session', session);
        }, 1000);

        setInterval(() =>
        {
            t += 0.1;

            for (const car of cars)
            {
                if (!car.in_pits)
                {
                    const dt = 0.1 * (1 + (Math.random() - 0.5) * 0.06);
                    const previousSpline = car.spline;

                    car._progress += dt / car._lapTime;
                    car.spline = car._progress % 1;
                    car.world_pos = trackPoint(car.spline);
                    car.current_lap = car.spline * car._lapTime;

                    // Lap completed: finish sector 3, roll into best sectors, restart the lap
                    if (car.spline < previousSpline)
                    {
                        car.laps += 1;
                        car.current_lap_sectors.sector3 = car._lapTime * 0.34 + (Math.random() - 0.4) * 0.4;

                        car.last_lap = car.current_lap_sectors.sector1
                                     + car.current_lap_sectors.sector2
                                     + car.current_lap_sectors.sector3;

                        if (car.last_lap > 0 && car.last_lap < car.best_lap)
                        {
                            car.best_lap = car.last_lap;
                            car.best_lap_sectors =
                            {
                                sector1: car.current_lap_sectors.sector1,
                                sector2: car.current_lap_sectors.sector2,
                                sector3: car.current_lap_sectors.sector3
                            };
                        }

                        car.current_lap_sectors = { sector1: -1, sector2: -1, sector3: -1 };
                    }

                    // Current sector times as the lap progresses
                    if (car.spline > 1 / 3 && car.current_lap_sectors.sector1 < 0)
                    {
                        car.current_lap_sectors.sector1 = car._lapTime * 0.31 + (Math.random() - 0.4) * 0.4;
                    }

                    if (car.spline > 2 / 3 && car.current_lap_sectors.sector2 < 0)
                    {
                        car.current_lap_sectors.sector2 = car._lapTime * 0.35 + (Math.random() - 0.4) * 0.4;
                    }
                }

                const cycle = Math.sin(t + parseInt(car.vehicle_number, 10));
                const speed = car.in_pits ? 40 + (cycle + 1) * 3 : 180 + cycle * 90;
                car.telemetry.speed = Math.max(0, speed);
            }

            const sorted = [...cars].sort((a, b) => b._progress - a._progress);
            sorted.forEach((car, i) => { car.race_position = i + 1; });

            const perClass = new Map();
            for (const car of sorted)
            {
                if (!perClass.has(car.vehicle_class)) perClass.set(car.vehicle_class, []);
                perClass.get(car.vehicle_class).push(car);
            }

            for (const group of perClass.values())
            {
                const leader = group[0];
                group.forEach((car, i) =>
                {
                    car.race_position_class = i + 1;
                    car.delta_to_class_leader = (leader._progress - car._progress) * car._lapTime;
                    car.delta_to_next = i === 0 ? 0 : (group[i - 1]._progress - car._progress) * car._lapTime;
                });
            }

            stateManager.setState('standings', sorted);
        }, 100);
    });
})();
