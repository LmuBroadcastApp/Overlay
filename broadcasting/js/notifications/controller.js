/**
 * @file Notification decision engine for the broadcasting overlay.
 */

/**
 * Watches session/standings changes and emits high-level notifications.
 */
class NotificationController
{
    /**
     * Creates the notification controller.
     *
     * @param {string} selector Unused panel selector placeholder for registry compatibility.
     * @param {StateManager} stateManager Shared page state manager.
     * @param {NotificationSystem} notifier Visual notification renderer.
     */
    constructor(selector, stateManager, notifier)
    {
        this.notifier = notifier;
        this.stateManager = stateManager;

        this.fast_lap = new Map();
        this.possible_fast_lap = new Map();
        this.stateManager.subscribe(this.handleStateChange.bind(this));

        this.notifications = null;
        this.session = null;

        this.standings_prev = null;
        this.standings_curr = null;
    }

    /**
     * Reacts to state changes and triggers relevant notification checks.
     *
     * @param {string} key Changed state key.
     * @param {*} value New state value.
     */
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
                this.possible_fast_lap.clear();
            }
        }

        if (key === 'overlay_settings')
        {
            this.notifications = value.notifications;
        }

        if (this.session != null)
        {
            this._update();
        }

        if (this.session != null && this.session.name == "QUALIFY")
        {
            this._notifyPossibleFastLap();
        }
    }

    /**
     * Emits qualifying notifications for laps projected to beat the class best.
     */
    _notifyPossibleFastLap()
    {
        let fast_lap = this.notifications?.possible_fast_lap ?? false;
        if (!this.standings_curr || fast_lap == false)
        {
            return
        }

        let splits = GetByClasses(this.standings_curr);
        splits.forEach((vehicles, classNmae) =>
        {
            let v = this._computePossbibleBestLap(vehicles);
            this._possibleBestLap(v);
        });
    }

    /**
     * Evaluates all enabled notification types for the latest state snapshot.
     */
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

    /**
     * Shows a race winner notification for a class once the leader finishes.
     *
     * @param {Array<Object>} vehicles Standings entries for one class.
     */
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

    /**
     * Tracks and notifies new class best laps.
     *
     * @param {Object} vehicle Vehicle that may have set the best lap.
     */
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

    /**
     * Notifies a potential qualifying best lap candidate.
     *
     * @param {?Object} vehicle Projected best-lap candidate.
     */
    _possibleBestLap(vehicle)
    {
        if (!vehicle) return;

        let last = this.possible_fast_lap.get(vehicle.vehicle_class);
        if (last && last.slot_id === vehicle.slot_id) return;

        this.possible_fast_lap.set(vehicle.vehicle_class, vehicle);

        let duration = this.notifications?.duration_sec * 1000 ?? 5000;
        this.notifier.show({ type: 'possible-best-lap', subtype: vehicle.vehicle_class, message: vehicle, duration: duration });
    }

    /**
     * Computes the best projected lap currently underway in a class.
     *
     * @param {Array<Object>} standings Standings entries for one class.
     * @returns {?Object} Best projected lap candidate, if any.
     */
    _computePossbibleBestLap(standings)
    {
        let classBest = Infinity;
        standings.forEach((v) =>
        {
            if (v.best_lap > 0 && v.best_lap < classBest) classBest = v.best_lap;
        });

        const result = [];
        standings.forEach((v) =>
        {
            if (v.best_lap > 0 && v.current_lap > 0)
            {
                let sector1_notification = v.current_lap_sectors.sector1 > 0;
                let sector2_notification = v.current_lap_sectors.sector2 > 0;
                let projected = v.best_lap + v.telemetry.delta;

                if (projected < classBest && (sector1_notification || sector2_notification))
                {
                    result.push
                    ({
                        slot_id: v.slot_id,
                        vehicle_number: v.vehicle_number,
                        vehicle_class: v.vehicle_class,
                        driver: v.driver,
                        best_lap: v.best_lap,
                        projected_lap: projected
                    });
                }
            }
        });

        const compareProjected = (a, b) => a.projected_lap - b.projected_lap;
        result.sort(compareProjected);

        return result.length > 0 ? result[0] : null;
    }

    /**
     * Detects and reports newly issued penalties.
     *
     * @param {Object} curr Current vehicle state.
     * @param {Object} prev Previous vehicle state.
     */
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

    /**
     * Detects and reports incident impacts over the configured threshold.
     *
     * @param {Object} curr Current vehicle state.
     * @param {Object} prev Previous vehicle state.
     */
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

    /**
     * Detects and reports new track limits warnings.
     *
     * @param {Object} curr Current vehicle state.
     * @param {Object} prev Previous vehicle state.
     */
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
