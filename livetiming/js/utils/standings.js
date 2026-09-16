/**
 * @file Standings formatting and aggregation helpers for the livetiming table.
 */

/**
 * Fast integer truncation helper for laptime formatting.
 *
 * @param {number} value Value to truncate.
 * @returns {number} Integer-truncated value.
 */
function float2int (value)
{
    return value | 0;
}

/**
 * Formats a laptime in seconds as mm:ss:ms.
 *
 * @param {?number} laptime Laptime in seconds.
 * @returns {string} Formatted laptime or placeholder.
 */
function LaptimeToString(laptime)
{
    if (laptime == null || laptime <= 0.1)
    {
        return "--:--:---";
    }

    let m = 0; let s = 0;
    let ms = laptime * 1000.0;

    if (ms >= 1000)
    {
        s = ms / 1000;  // seconds
        ms %= 1000;     // remaining milliseconds

        m = s / 60;     // minutes
        s %= 60;        // remaining seconds
    }

    m  = float2int(m);
    s  = float2int(s);
    ms = float2int(ms);

    const formattedM  =  m.toString().padStart(2, '0');
    const formattedS  =  s.toString().padStart(2, '0');
    const formattedMs = ms.toString().padStart(3, '0');

    return `${formattedM}:${formattedS}:${formattedMs}`;
}

/**
 * Formats the penalty badges for a vehicle.
 *
 * @param {Object} vehicle Vehicle standings entry.
 * @returns {string} HTML string with zero or more penalty badges.
 */
function GetPenalties(vehicle)
{
    let result = "";

    if (vehicle.penalties.drive_through > 0)
    {
        result += "<span class='penalty'>DT</span>";
    }

    if (vehicle.penalties.stop_and_go > 0)
    {
        result += "<span class='penalty'>SG</span>";
    }

    if (vehicle.penalties.time_penalty > 0)
    {
        result += "<span class='penalty'>+" + vehicle.penalties.time_penalty + "</span>";
    }

    return result;
}

/**
 * Returns whether a sector time is valid.
 *
 * @param {number} time Sector time in seconds.
 * @returns {boolean} True when the value represents a valid time.
 */
function IsValidTime(time)
{
    return time > 0;
}

/**
 * Formats a sector time with millisecond precision.
 *
 * @param {?number} sector Sector time in seconds.
 * @returns {string} Formatted sector time or placeholder.
 */
function Sector2String(sector)
{
    if (sector == null || sector <= 0.01)
    {
        return '--:---';
    }

    return sector.toFixed(3);
}

/**
 * Finds the best lap times for one vehicle class across the whole standings.
 *
 * @param {Array<Object>} standings Full standings array.
 * @param {string} vehicle_class Class name to filter by.
 * @returns Best sector times for the class or -1.
 */
function GetBestLapTime(standings, vehicle_class)
{
    const max_time = 99999999999;
    let result = max_time;

    for (let i = 0; i < standings.length; ++i)
    {
        if (standings[i].vehicle_class !== vehicle_class)
        {
            continue;
        }

        if (standings[i].best_lap > 0)
        {
            result = Math.min(result, standings[i].best_lap)
        }
    }

    if (result === max_time)
    {
        return -1;
    }

    return result;
}

/**
 * Finds the best sector times for one vehicle class across the whole standings.
 *
 * @param {Array<Object>} standings Full standings array.
 * @param {string} vehicle_class Class name to filter by.
 * @returns {{S1:number,S2:number,S3:number}} Best sector times for the class.
 */
function GetBestSectors(standings, vehicle_class)
{
    let result = { S1: -1, S2: -1, S3: -1 };
    if (standings.length < 1) return result;

    for (let i = 0; i < standings.length; ++i)
    {
        if (standings[i].vehicle_class !== vehicle_class)
        {
            continue;
        }

        if (standings[i].best_lap_sectors.sector1 > 0 && result.S1 < 0)
        {
            result.S1 = standings[i].best_lap_sectors.sector1;
        }
        else if (standings[i].best_lap_sectors.sector1 > 0 && standings[i].best_lap_sectors.sector1 < result.S1)
        {
            result.S1 = standings[i].best_lap_sectors.sector1;
        }

        if (standings[i].best_lap_sectors.sector2 > 0 && result.S2 < 0)
        {
            result.S2 = standings[i].best_lap_sectors.sector2;
        }
        else if (standings[i].best_lap_sectors.sector2 > 0 && standings[i].best_lap_sectors.sector2 < result.S2)
        {
            result.S2 = standings[i].best_lap_sectors.sector2;
        }

        if (standings[i].best_lap_sectors.sector3 > 0 && result.S3 < 0)
        {
            result.S3 = standings[i].best_lap_sectors.sector3;
        }
        else if (standings[i].best_lap_sectors.sector3 > 0 && standings[i].best_lap_sectors.sector3 < result.S3)
        {
            result.S3 = standings[i].best_lap_sectors.sector3;
        }
    }

    return result;
}

/**
 * Returns a representative lap time used for race-lap projections.
 * (Kept exactly as you provided it)
 */
function GetLapTimeForTotalRaceLaps(standings)
{
    for (const vehicle of standings)
    {
        if (vehicle.last_lap > 0) return vehicle.last_lap;
        if (vehicle.best_lap > 0) return vehicle.best_lap;
        if (vehicle.qualy_best_lap > 0) return vehicle.qualy_best_lap;
    }
    return -1;
}

/**
 * Estimates total race laps factoring in Ve consumption and pit stops.
 *
 * @param {Array<Object>} standings Standings rows.
 * @param {number} raceTime Remaining race duration in seconds.
 * @returns {(string|number)} Estimated total laps or placeholder.
 */
function GetTotalRaceLapsVe(standings, raceTime)
{
    const representative = GetLapTimeForTotalRaceLaps(standings);
    if (representative <= 0 || raceTime <= 0) return "-";

    const leaderVehicle = standings[0];
    const AVERAGE_PIT_STOP_TIME = 60;

    const vePerLap = leaderVehicle.fuel_monitor.ve_per_lap;
    let currentVe = leaderVehicle.telemetry.ve;

    if (vePerLap < 2.0)
    {
        return Math.round((raceTime / representative) + leaderVehicle.laps);
    }

    let timeRemaining = raceTime;
    let projectedLaps = 0;

    // Simulate the rest of the race
    while (timeRemaining > 0)
    {
        if (timeRemaining < representative)
        {
            break;
        }

        timeRemaining -= representative;
        currentVe -= vePerLap;
        projectedLaps++;

        if (currentVe <= vePerLap)
        {
            if (timeRemaining >= (AVERAGE_PIT_STOP_TIME + representative))
            {
                timeRemaining -= AVERAGE_PIT_STOP_TIME;
                currentVe = 100; // Refill to max
            }
            else
            {
                break;
            }
        }
    }

    return leaderVehicle.laps + projectedLaps;
}

/**
 * Estimates total race laps factoring in fuel consumption and pit stops.
 *
 * @param {Array<Object>} standings Standings rows.
 * @param {number} raceTime Remaining race duration in seconds.
 * @returns {(string|number)} Estimated total laps or placeholder.
 */
function GetTotalRaceLapsFuel(standings, raceTime)
{
    const representative = GetLapTimeForTotalRaceLaps(standings);
    if (representative <= 0 || raceTime <= 0) return "-";

    const leaderVehicle = standings[0];
    const AVERAGE_PIT_STOP_TIME = 60;

    const fuelPerLap = leaderVehicle.fuel_monitor.fl_per_lap;
    let currentFuel = leaderVehicle.telemetry.fuel;

    if (fuelPerLap < 2.0)
    {
        return Math.round((raceTime / representative) + leaderVehicle.laps);
    }

    let timeRemaining = raceTime;
    let projectedLaps = 0;

    // Simulate the rest of the race
    while (timeRemaining > 0)
    {
        if (timeRemaining < representative)
        {
            break;
        }

        timeRemaining -= representative;
        currentFuel -= fuelPerLap;
        projectedLaps++;

        if (currentFuel <= fuelPerLap)
        {
            if (timeRemaining >= (AVERAGE_PIT_STOP_TIME + representative))
            {
                timeRemaining -= AVERAGE_PIT_STOP_TIME;
                currentFuel = leaderVehicle.telemetry.max_fuel; // Refill to max
            }
            else
            {
                break;
            }
        }
    }

    return leaderVehicle.laps + projectedLaps;
}

/**
 * Estimates total race laps factoring in fuel/Ve consumption and pit stops.
 *
 * @param {Array<Object>} standings Standings rows.
 * @param {number} raceTime Remaining race duration in seconds.
 * @returns {(string|number)} Estimated total laps or placeholder.
 */
function GetTotalRaceLaps(standings, raceTime)
{
    if (standings.length == 0) return 0;
    const cls = standings[0].vehicle_class.toLowerCase();

    if (cls === 'gt3' || cls === 'hyper')
    {
        return GetTotalRaceLapsVe(standings, raceTime);
    }

    return GetTotalRaceLapsFuel(standings, raceTime);
}

/**
 * Groups standings rows by vehicle class while preserving their current order.
 *
 * @param {Array<Object>} standings Full standings array.
 * @returns {Map<string, Array<Object>>} Vehicles grouped by class.
 */
function GetByClasses(standings)
{
    const perCategory = new Map();

    for (const vehicle of standings)
    {
        if (!perCategory.has(vehicle.vehicle_class))
        {
            perCategory.set(vehicle.vehicle_class, []);
        }
        perCategory.get(vehicle.vehicle_class).push(vehicle);
    }

    return perCategory;
}
