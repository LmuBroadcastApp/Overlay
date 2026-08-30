/**
 * @file Mock data provider for local styling and preview of the broadcasting page.
 */
(function ()
{
    if (!window.location.search.includes('mock'))
    {
        return;
    }

    window.MOCK_MODE = true;

    const TRACK_DISTANCE = 4000;       /** meters */
    const MAP_SIZE = { width: 400, height: 300 };

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
     * Builds a procedural track map and pit lane for mock mode.
     *
     * @returns {{track_map:Array<Object>, pit_lane:Array<Object>, size:{width:number,height:number}, sectors:Object}}
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
            size: MAP_SIZE,
            sectors: { sector1: 0, sector2: TRACK_DISTANCE / 3, sector3: (TRACK_DISTANCE / 3) * 2 }
        };
    }

    /**
     * Builds a mock overlay settings payload.
     *
     * @returns {Object} Overlay settings payload.
     */
    function mockOverlaySettings()
    {
        return {
            standings:
            {
                enabled: true,
                position_left: '1.0rem', position_top: '1.0rem',
                font_weight: 550, font_size: '1em',
                primary_color: 'rgba(14, 17, 24, 0.86)', secondary_color: 'rgba(14, 17, 24, 0.64)',
                gap_less_1_color: 'rgb(242, 92, 84)', gap_less_2_color: 'rgb(247, 178, 103)',
                col_01_width: '24px', col_02_width: '32px', col_03_width: '160px', col_04_width: '48px',
                col_05_width: '48px', col_06_width: '48px', col_07_width: '48px',
                gain_position_color: 'rgb(41, 156, 143)', lost_position_color: 'rgb(230, 110, 79)',
                sector_inactive_color: 'rgba(120, 128, 140, 0.45)',
                sector_1_color: 'rgb(255, 209, 102)', sector_2_color: 'rgb(6, 214, 160)', sector_3_color: 'rgb(162, 155, 254)'
            },
            session:  { enabled: true, position_top: '1.0rem', font_size: '1em' },
            driver:
            {
                enabled: true,
                position_bottom: '1.0rem', position_right: '1.0rem',
                background_color: 'rgba(14, 17, 24, 0.88)', font_size: '1em', width: '400px'
            },
            weather:
            {
                enabled: true,
                position_right: '1.0rem', position_top: '1.0rem',
                image_width: '24px', font_size: '1em',
                header_background_color: 'rgba(12, 14, 20, 0.92)',
                body_background_color: 'rgba(16, 19, 26, 0.72)',
                text_color: 'rgb(240, 240, 240)'
            },
            map:      { enabled: true, position_right: '1rem', position_top: '30rem' },
            replay:   { enabled: true, position_left: '1rem', position_top: '1rem' },
            relative: { enabled: true, position_bottom: '1rem', position_left: '1rem', font_weight: 550, font_size: '1em', panel_width: '500px' },
            notifications:
            {
                enabled: true,
                position_left: '50rem', position_top: '1rem',
                font_size: '1em', panel_width: '400px',
                fast_lap: true, penalties: true, incidents: false,
                race_winner: true, track_limits: false, possible_fast_lap: false,
                duration_sec: 5, impact_threshold: 500
            },
            telemetry: { enabled: true, gauge_size: '60px' }
        };
    }

    /**
     * Builds a mock overlay controls payload.
     *
     * @returns {Object} Overlay controls payload.
     */
    function mockControls()
    {
        return {
            update_rate: 3,
            static_entries: 5,
            dynamic_entries: 5,
            overtake_animation_speed: 2,
            overlay_animation_speed: 0,
            gap_mode: 'leader',
            name_source: 'driver',
            driver_name: 'short',
            vehicle_class: 'multiclass',
            sector_bars: true,
            show_telemetry: true,
            show_last_pitstop: true,
            extras: { energy_fuel: true, best_lap: true, last_lap: true, tires: true, pos_gain_lost: true }
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
            gamePhase: 5,
            replayActive: false,
            sectorFlags: [false, false, false],

            currentEventTime: currentEventTime,
            endEventTime: 7200,
            eventTimeRemaining: 7200 - currentEventTime,
            inGameTime: 14 * 3600 + currentEventTime,

            trackDistance: TRACK_DISTANCE,
            max_cut_points: 30,

            windSpeed: 12.4,
            raining: 0.0,
            cloudCoverage: 2,
            gripLevel: 3,
            averagePathWetness: 0.0,
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
        };
    }

    /**
     * Builds a mini-sector time array compatible with both array and { time: [] } readers.
     *
     * @param {number} base Base sector time.
     * @returns {Array<number>} Mini-sector timing array.
     */
    function miniSectorTimes(base)
    {
        const arr = [];
        for (let k = 0; k < 6; ++k)
        {
            arr.push(base / 6 + (k % 3) * 0.15);
        }
        arr.time = arr;
        return arr;
    }

    /**
     * Builds one mock standings entry.
     *
     * @param {Object} cfg Vehicle configuration.
     * @returns {Object} Mock vehicle row.
     */
    function makeCar(cfg)
    {
        const s1 = cfg.lapTime * 0.31;
        const s2 = cfg.lapTime * 0.35;
        const s3 = cfg.lapTime * 0.34;

        return {
            slot_id: cfg.slot_id,
            focus: cfg.focus === true,

            driver: cfg.driver,
            vehicle_name: cfg.team,
            vehicle_number: cfg.number,
            vehicle_class: cfg.vehicle_class,
            manufacturer: cfg.manufacturer,

            status: '',
            in_pits: cfg.in_pits === true,
            show_warning_icon: cfg.warning === true,

            laps: 0,
            current_lap: 0,
            last_lap: -1,
            best_lap: -1,
            qualy_best_lap: cfg.lapTime,

            spline: cfg.spline,
            world_pos: trackPoint(cfg.spline),

            race_position: 0,
            race_position_class: 0,
            qualy_position_class: cfg.qualy_position_class,

            delta_to_next: 0,
            delta_to_class_leader: 0,
            laps_behind_next: 0,
            laps_behind_class_leader: 0,
            relative_delta_to_next: 99,
            relative_delta_to_prev: 99,

            pit_stops: cfg.pit_stops || 0,
            pitstops: cfg.pitstops || [],
            penalties: { drive_through: 0, stop_and_go: 0, time_penalty: cfg.time_penalty || 0 },
            impact: { et: 0, points: 0 },
            cut_points: 0,
            damage: cfg.damage || 0,

            tire_compound: cfg.tires || ['Medium', 'Medium', 'Medium', 'Medium'],

            overtake_highligh_gain_until: 0,
            overtake_highligh_lost_until: 0,

            best_lap_sectors: { sector1: -1, sector2: -1, sector3: -1 },
            current_lap_sectors: { sector1: -1, sector2: -1, sector3: -1 },

            mini_sector_current: [new Array(6).fill(-1), new Array(6).fill(-1), new Array(6).fill(-1)],
            mini_sector_best: [miniSectorTimes(s1), miniSectorTimes(s2), miniSectorTimes(s3)],

            telemetry:
            {
                speed: 0, gear: 0, rpm: 0, max_rpm: 9000,
                throttle: 0, brake: 0,
                fuel: cfg.fuel || 0, ve: cfg.ve || 0,
                delta: 0
            },

            /** mock-internal */
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
            makeCar({ slot_id:  1, number: '7',  driver: 'Kamui Kobayashi',   team: 'Toyota Gazoo Racing',    vehicle_class: 'Hyper', manufacturer: 'Toyota',   lapTime: 92.1, spline: 0.62, qualy_position_class: 2, ve: 68, damage:  0.0, tires: ['Medium', 'Medium', 'Medium', 'Medium'] }),
            makeCar({ slot_id:  2, number: '6',  driver: 'Kevin Estre',       team: 'Porsche Penske Motorsport', vehicle_class: 'Hyper', manufacturer: 'Porsche', lapTime: 92.4, spline: 0.58, qualy_position_class: 1, ve: 55, damage:  2.1, pit_stops: 1, pitstops: [{ session: 'RACE', lap: 8, pit_lane_time: 52.4 }] }),
            makeCar({ slot_id:  3, number: '50', driver: 'Antonio Fuoco',     team: 'Ferrari AF Corse',       vehicle_class: 'Hyper', manufacturer: 'Ferrari',  lapTime: 92.8, spline: 0.51, qualy_position_class: 3, ve: 41, damage:  8.5, time_penalty: 5, warning: true }),
            makeCar({ slot_id:  4, number: '2',  driver: 'Earl Bamber',       team: 'Cadillac Racing',        vehicle_class: 'Hyper', manufacturer: 'Cadillac', lapTime: 93.2, spline: 0.44, qualy_position_class: 4, ve: 23, damage:  0.0 }),

            makeCar({ slot_id:  5, number: '22', driver: 'Filipe Albuquerque', team: 'United Autosports',     vehicle_class: 'LMP2', manufacturer: 'Oreca',    lapTime: 97.0, spline: 0.31, qualy_position_class: 1, fuel: 48, damage:  0.0 }),
            makeCar({ slot_id:  6, number: '28', driver: 'Oliver Rasmussen',  team: 'IDEC Sport',             vehicle_class: 'LMP2', manufacturer: 'Oreca',    lapTime: 97.4, spline: 0.28, qualy_position_class: 3, fuel: 27, damage:  4.2 }),
            makeCar({ slot_id:  7, number: '9',  driver: 'Mathias Beche',     team: 'Proton Competition',     vehicle_class: 'LMP2', manufacturer: 'Oreca',    lapTime: 97.7, spline: 0.22, qualy_position_class: 2, fuel:  8, damage:  0.0 }),
            makeCar({ slot_id:  8, number: '35', driver: 'Paul-Loup Chatin',  team: 'Alpine Endurance Team',  vehicle_class: 'LMP2', manufacturer: 'Alpine',   lapTime: 98.1, spline: 0.15, qualy_position_class: 4, fuel: 52, damage: 12.3, in_pits: true }),

            makeCar({ slot_id:  9, number: '92', driver: 'Michael Christensen', team: 'Manthey EMA',          vehicle_class: 'GT3', manufacturer: 'Porsche',  lapTime: 105.0, spline: 0.080, qualy_position_class: 2, ve: 61, damage: 0.0, focus: true }),
            makeCar({ slot_id: 10, number: '81', driver: 'Charlie Eastwood',  team: 'TF Sport',               vehicle_class: 'GT3', manufacturer: 'Corvette', lapTime: 105.2, spline: 0.086, qualy_position_class: 1, ve: 44, damage: 1.5 }),
            makeCar({ slot_id: 11, number: '59', driver: 'James Cottingham',  team: 'United Autosports',      vehicle_class: 'GT3', manufacturer: 'McLaren',  lapTime: 105.5, spline: 0.072, qualy_position_class: 4, ve: 29, damage: 0.0, tires: ['Soft', 'Soft', 'Medium', 'Medium'] }),
            makeCar({ slot_id: 12, number: '87', driver: 'Jose Maria Lopez',  team: 'Akkodis ASP Team',       vehicle_class: 'GT3', manufacturer: 'Lexus',    lapTime: 105.9, spline: 0.030, qualy_position_class: 3, ve: 74, damage: 0.0 })
        ];
    }

    window.addEventListener('load', () =>
    {
        const map = buildTrackMap();
        const cars = buildField();

        let eventTime = 1800;
        let t = 0;

        UpdateOverlaySettings(mockOverlaySettings());
        stateManager.setState('overlay_controls', mockControls());
        stateManager.setState('overlay_settings', mockOverlaySettings());
        stateManager.setState('session', mockSession(eventTime));
        stateManager.setState('map', map);

        setInterval(() =>
        {
            eventTime += 1;
            stateManager.setState('session', mockSession(eventTime));
        }, 1000);

        setInterval(() =>
        {
            t += 0.1;

            for (const car of cars)
            {
                if (car.in_pits) continue;

                /** Advance along the track with a little pace noise */
                const dt = 0.1 * (1 + (Math.random() - 0.5) * 0.06);
                const prevProgress = car._progress;

                car._progress += dt / car._lapTime;
                car.spline = car._progress % 1;
                car.world_pos = trackPoint(car.spline);
                car.current_lap = car.spline * car._lapTime;

                /** Lap completed */
                if (Math.floor(car._progress) > Math.floor(prevProgress))
                {
                    car.laps = Math.floor(car._progress);
                    car.last_lap = car._lapTime + (Math.random() - 0.3) * 1.2;

                    if (car.best_lap <= 0 || car.last_lap < car.best_lap)
                    {
                        car.best_lap = car.last_lap;
                        car.best_lap_sectors =
                        {
                            sector1: car.best_lap * 0.31,
                            sector2: car.best_lap * 0.35,
                            sector3: car.best_lap * 0.34
                        };
                    }

                    car.current_lap_sectors = { sector1: -1, sector2: -1, sector3: -1 };
                    car.mini_sector_current = [new Array(6).fill(-1), new Array(6).fill(-1), new Array(6).fill(-1)];
                }

                /** Current sector / mini sector times as the lap progresses */
                if (car.spline > 1 / 3 && car.current_lap_sectors.sector1 < 0)
                {
                    car.current_lap_sectors.sector1 = car._lapTime * 0.31 + (Math.random() - 0.4) * 0.4;
                }
                if (car.spline > 2 / 3 && car.current_lap_sectors.sector2 < 0)
                {
                    car.current_lap_sectors.sector2 = car._lapTime * 0.35 + (Math.random() - 0.4) * 0.4;
                }

                const mini = Math.floor(car.spline * 18);
                for (let k = 0; k < mini; ++k)
                {
                    const s = Math.floor(k / 6);
                    const i = k % 6;

                    if (car.mini_sector_current[s][i] < 0)
                    {
                        car.mini_sector_current[s][i] = car.mini_sector_best[s][i] + (Math.random() - 0.4) * 0.2;
                    }
                }

                /** Telemetry (animated for everyone, the focused car drives the gauges) */
                const cycle = Math.sin(t + car.slot_id);
                const speed = 180 + cycle * 90;

                car.telemetry.speed = speed;
                car.telemetry.gear = Math.max(2, Math.min(7, Math.floor(speed / 40)));
                car.telemetry.rpm = 5000 + ((speed % 40) / 40) * 3800;
                car.telemetry.throttle = Math.min(1, Math.max(0, cycle * 1.4));
                car.telemetry.brake = Math.min(1, Math.max(0, -cycle * 1.6));
            }

            /** Overall race order */
            const sorted = [...cars].sort((a, b) => b._progress - a._progress);
            sorted.forEach((car, i) => { car.race_position = i + 1; });

            /** Per-class positions and gaps */
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
                    const prevClassPos = car.race_position_class;
                    car.race_position_class = i + 1;

                    if (prevClassPos > 0 && prevClassPos !== car.race_position_class)
                    {
                        if (car.race_position_class < prevClassPos) car.overtake_highligh_gain_until = Date.now() + 2000;
                        else car.overtake_highligh_lost_until = Date.now() + 2000;
                    }

                    car.delta_to_class_leader = (leader._progress - car._progress) * car._lapTime;
                    car.delta_to_next = i === 0 ? 0 : (group[i - 1]._progress - car._progress) * car._lapTime;
                });
            }

            /** Relative (on-track) deltas, used by the battle panel */
            const bySpline = [...cars].sort((a, b) => b.spline - a.spline);
            bySpline.forEach((car, i) =>
            {
                const next = i > 0 ? bySpline[i - 1] : bySpline[bySpline.length - 1];
                const prev = i < bySpline.length - 1 ? bySpline[i + 1] : bySpline[0];

                car.relative_delta_to_next = -(((next.spline - car.spline) + 1) % 1) * car._lapTime;
                car.relative_delta_to_prev = (((car.spline - prev.spline) + 1) % 1) * car._lapTime;
            });

            stateManager.setState('standings', sorted);
        }, 100);
    });
})();
