class NotificationController
{
    constructor(selector, stateManager, notifier)
    {
        this.notifier = notifier;
        this.stateManager = stateManager;

        this.fast_lap = new Map();
        this.stateManager.subscribe(this.handleStateChange.bind(this));

        this.notifications = null;
        this.session = null;

        this.standings_prev = null;
        this.standings_curr = null;
    }

    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            if (this.standings_curr)
            {
                this.standings_prev = Array.from(this.standings_curr);
            }
            this.standings_curr = value;
        }

        if (key === 'session')
        {
            if (this.session == null)
            {
                this.session = value;
                return;
            }

            if (value.name != this.session.name)
            {
                this.session = value;
                this.fast_lap.clear();
            }
        }

        if (key === 'overlay')
        {
            this.notifications = value.notifications;
        }

        this._update();
    }

    update()
    {

    }

    _update()
    {
        let fast_lap = this.notifications?.fast_lap ?? true;
        let penalties = this.notifications?.penalties ?? true;
        let incidents = this.notifications?.incidents ?? false;
        let race_winner = this.notifications?.race_winner ?? true;
        let track_limits = this.notifications?.track_limits ?? false;

        if (fast_lap && this.standings_curr)
        {
            let list = this.standings_curr.filter((vehicle) => vehicle.best_lap > 0);
            const compareBestLaps = (a, b) => a.best_lap - b.best_lap;

            list.sort(compareBestLaps);
            list.forEach((vehicle) => (this._bestLap(vehicle)));
        }

        if (race_winner && this.standings_curr)
        {
            let splits = GetByClasses(this.standings_curr);
            splits.forEach((vehicles, className) =>
            {
                this._raceWinner(vehicles);
            });
        }

        if (this.standings_curr && this.standings_prev)
        {
            let sz = Math.min(this.standings_curr.length, this.standings_prev.length);
            for (let i = 0; i < sz; i++)
            {
                let old_vehicle = this.standings_prev[i];
                let new_vehicle = this.standings_curr[i];

                if (old_vehicle.slot_id === new_vehicle.slot_id)
                {
                    if (penalties)    this._penalty(new_vehicle, old_vehicle);
                    if (incidents)    this._incidents(new_vehicle, old_vehicle);
                    if (track_limits) this._trackLmits(new_vehicle, old_vehicle);
                }
            }
        }
    }

    _raceWinner(vehicles)
    {
        if (vehicles[0].status != 'Finished' || this.session.name != 'RACE') return;
        let gap = vehicles.length > 1 ? vehicles[1].delta_to_class_leader.toFixed(1) : '0.0';

        let msg =
        {
            vehicle_number: vehicles[0].vehicle_number,
            vehicle_class: vehicles[0].vehicle_class,
            driver: vehicles[0].driver,
            type: 'Race Finished',
            gap: gap
        };

        let duration = this.notifications?.duration_sec * 1000 ?? 5000;
        this.notifier.show({ type: 'winner', subtype: vehicles[0].vehicle_class, message: msg, duration: duration * 5 });
    }

    _bestLap(vehicle)
    {
        if (vehicle.best_lap <= 0) return;
        let show_notification = false;

        if (!this.fast_lap.has(vehicle.vehicle_class))
        {
            this.fast_lap.set(vehicle.vehicle_class, vehicle);
            show_notification = true;
        }

        if (vehicle.best_lap < this.fast_lap.get(vehicle.vehicle_class).best_lap)
        {
            this.fast_lap.set(vehicle.vehicle_class, vehicle)
            show_notification = true;
        }

        if (show_notification)
        {
            let duration = this.notifications?.duration_sec * 1000 ?? 5000;
            this.notifier.show({ type: 'fast-lap', subtype: vehicle.vehicle_class, message: vehicle, duration: duration });
        }
    }

    _penalty(curr, prev)
    {
        if (curr.penalties.drive_through > prev.penalties.drive_through)
        {
            let msg =
            {
                vehicle_number: curr.vehicle_number,
                vehicle_class: curr.vehicle_class,
                driver: curr.driver,
                type: 'Drive Through',
                penalty: '+' + curr.penalties.drive_through
            };

            let duration = this.notifications?.duration_sec * 1000 ?? 5000;
            this.notifier.show({ type: 'penalty', message: msg, duration: duration });
        }

        if (curr.penalties.stop_and_go > prev.penalties.stop_and_go)
        {
            let msg =
            {
                vehicle_number: curr.vehicle_number,
                vehicle_class: curr.vehicle_class,
                driver: curr.driver,
                type: 'Stop & Go',
                penalty: '+' + curr.penalties.stop_and_go
            };

            let duration = this.notifications?.duration_sec * 1000 ?? 5000;
            this.notifier.show({ type: 'penalty', message: msg, duration: duration });
        }

        if (curr.penalties.time_penalty > prev.penalties.time_penalty)
        {
            let msg =
            {
                vehicle_number: curr.vehicle_number,
                vehicle_class: curr.vehicle_class,
                driver: curr.driver,
                type: 'Time',
                penalty: curr.penalties.time_penalty + 's'
            };

            let duration = this.notifications?.duration_sec * 1000 ?? 5000;
            this.notifier.show({ type: 'penalty', message: msg, duration: duration });
        }
    }

    _incidents(curr, prev)
    {
        let impact_threshold = this.notifications?.impact_threshold ?? 500;

        if (curr.impact.et > prev.impact.et && curr.impact.points > impact_threshold)
        {
            let msg =
            {
                vehicle_number: curr.vehicle_number,
                vehicle_class: curr.vehicle_class,
                driver: curr.driver,
                type: 'Impact',
                impact: curr.impact.points.toFixed(0) + ' points'
            };

            let duration = this.notifications?.duration_sec * 1000 ?? 5000;
            this.notifier.show({ type: 'impact', message: msg, duration: duration });
        }
    }

    _trackLmits(curr, prev)
    {
        if (curr.cut_points > prev.cut_points)
        {
            let p = curr.cut_points - prev.cut_points;
            p = p.toFixed(2)

            let msg =
            {
                vehicle_number: curr.vehicle_number,
                vehicle_class: curr.vehicle_class,
                driver: curr.driver,
                type: 'Track limits',
                penalty: curr.cut_points + "/" + this.session.max_cut_points
            };

            let duration = this.notifications?.duration_sec * 1000 ?? 5000;
            this.notifier.show({ type: 'track-limits', message: msg, duration: duration });
        }
    }
}
