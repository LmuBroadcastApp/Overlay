/**
 * @file Standings, class, tire, and timing helpers for the broadcasting overlay.
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
 * Chooses the display name for a vehicle using the overlay control settings.
 *
 * @param {Object} vehicle Vehicle standings row.
 * @param {Object} controls Overlay controls payload.
 * @returns {string} Driver or team name in the requested format.
 */
function VehicleGetName(vehicle, controls)
{
    if (controls.name_source.toLowerCase() == "team")
    {
        return vehicle.vehicle_name;
    }

    if (controls.driver_name.toLowerCase() == "full") return vehicle.driver;
    let names = vehicle.driver.split(" ");

    if (names.length > 1)
    {
        return names[0].substring(0, 1) + ". " + names[names.length - 1];
    }

    return vehicle.driver;
}

/**
 * Computes the displayed gap text for a vehicle.
 *
 * @param {Object} vehicle Vehicle standings row.
 * @param {Object} controls Overlay controls payload.
 * @param {boolean} isRace Whether the current session is a race.
 * @returns {(string|number)} Gap string/value for display.
 */
function VehicleGetGap(vehicle, controls, isRace)
{
    let gap = -1;

    if (controls.gap_mode.toLowerCase() == "leader")
    {
        if (isRace && vehicle.laps_behind_class_leader > 0)
        {
            gap = vehicle.laps_behind_class_leader + "L";
        }
        else
        {
            gap = vehicle.delta_to_class_leader.toFixed(1);
        }
    }
    else
    {
        if (isRace && vehicle.laps_behind_next > 0)
        {
            gap = vehicle.laps_behind_next + "L";
        }
        else
        {
            gap = Math.abs(vehicle.delta_to_next.toFixed(1));
        }
    }

    if (!isRace)
    {
        gap = vehicle.delta_to_class_leader.toFixed(1);
        if (gap < 0) gap = "-";
    }

    if (vehicle.status == "DQ" || vehicle.status == "DNF")
    {
        gap = vehicle.status;
    }

    return gap;
}

/**
 * Formats the energy/fuel cell text and low-level warning style.
 *
 * @param {Object} vehicle Vehicle standings row.
 * @returns {{style:string,text:string}} Cell text plus inline style fragment.
 */
function GetVehicleFuelVe(vehicle)
{
    let result = { style: "", text: "" };
    let amount = 0;

    if (vehicle.telemetry.ve <= 0)
    {
        amount = vehicle.telemetry.fuel;
        result.text = vehicle.telemetry.fuel.toFixed(0) + "L";
    }
    else
    {
        amount = vehicle.telemetry.ve;
        result.text = vehicle.telemetry.ve.toFixed(0) + "%";
    }

    if (amount < 10)
    {
        result.style = 'style="color: rgb(249, 87, 56)"';
    }
    else if (amount < 30)
    {
        result.style = 'style="color: rgb(244, 211, 94)"';
    }

    return result;
}

/**
 * Finds the best lap in the whole field or within one class.
 *
 * @param {Array<Object>} standings Full standings array.
 * @param {string=} vehicle_class Optional class filter.
 * @returns {{lap:?number,id:?number}} Best lap metadata.
 */
function GetBestLapTime(standings, vehicle_class)
{
    let bestLap =
    {
        lap: null,
        id : null
    };

    for (const vehicle of standings)
    {
        if (vehicle_class !== undefined && vehicle.vehicle_class !== vehicle_class)
        {
            continue;
        }

        if (vehicle.best_lap > 0)
        {
            if (bestLap.lap === null || vehicle.best_lap < bestLap.lap)
            {
                bestLap.lap = vehicle.best_lap;
                bestLap.id = vehicle.slot_id;
            }
        }
    }

    return bestLap;
}

/**
 * Returns a representative lap time used for race-lap projections.
 *
 * @param {Array<Object>} standings Full standings array.
 * @returns {number} Representative lap time in seconds, or -1.
 */
function GetLapTimeForTotalRaceLaps(standings)
{
    for (const vehicle of standings)
    {
        if (vehicle.last_lap > 0)
        {
            return vehicle.last_lap;
        }

        if (vehicle.best_lap > 0)
        {
            return vehicle.best_lap;
        }

        if (vehicle.qualy_best_lap > 0)
        {
            return vehicle.qualy_best_lap;
        }
    }

    return -1;
}

/**
 * Estimates total race laps from race duration and representative pace.
 *
 * @param {Array<Object>} standings Full standings array.
 * @param {number} raceTime Race duration in seconds.
 * @returns {(string|number)} Estimated total laps or placeholder.
 */
function GetTotalRaceLaps(standings, raceTime)
{
    let laps = raceTime / GetLapTimeForTotalRaceLaps(standings);
    return laps <= 0 ? "-" : (laps + standings[0].laps + 1).toFixed(1);
}

/**
 * Filters standings rows by vehicle class.
 *
 * @param {Array<Object>} standings Full standings array.
 * @param {string} className Vehicle class name.
 * @returns {Array<Object>} Vehicles belonging to the class.
 */
function GetVehicleOfClass(standings, className)
{
    let vehicles = [];

    for (const vehicle of standings)
    {
        if (vehicle.vehicle_class.toLowerCase() === className.toLowerCase())
        {
            vehicles.push(vehicle);
        }
    }

    return vehicles;
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

/**
 * Returns whether a CSS class exists in any accessible stylesheet.
 *
 * @param {string} className CSS class name to test.
 * @returns {boolean} True when the class selector exists.
 */
function ClassExists(className)
{
    if (className.trim() === '') return false;
    className = className.replace('.', '');

    for (let sheet of document.styleSheets)
    {
        try
        {
            const rules = sheet.cssRules || sheet.rules;
            for (let rule of rules)
            {
                if (rule.selectorText && rule.selectorText.includes('.' + className))
                {
                    return true;
                }
            }
        }
        catch(e)
        {
            // Cross-origin stylesheets may cause errors
            //console.warn('Cannot access stylesheet:', e);
        }
    }

    return false;
}

/**
 * Maps a vehicle class to the overlay color used across broadcasting panels.
 *
 * @param {string} className Vehicle class name.
 * @returns {string} CSS color string.
 */
function ColorFromVehicleClass(className)
{
    switch (className.toLowerCase())
    {
        case "gt3":
        {
            return "rgba(0, 143, 55, 1.0)";
        }
        case "gte":
        {
            return "rgba(240, 140, 0, 1.0)";
        }
        case "lmp2":
        {
            return "rgba(6, 75, 145, 1.0)";
        }
        case "lmp3":
        {
            return "rgba(58, 25, 74, 1.0)";
        }
        case "hyper":
        {
            return "rgba(171, 24, 20, 1.0)";
        }
        case "lmp2_elms":
        {
            return "rgba(190, 74, 9, 1.0)";
        }
        default:
        {
            return "rgba(79, 93, 117, 1.0)";
        }
    }
}

/**
 * Produces a safe CSS class name for a vehicle class, falling back when absent.
 *
 * @param {string} className Vehicle class name.
 * @returns {string} CSS class name present in the stylesheets.
 */
function CSSClassFromVehicleClass(className)
{
    let cls = (className || '').replace(/[^a-zA-Z0-9]/g, '_');
    return ClassExists(cls) ? cls : 'generic-class';
}

/**
 * Finds the currently focused vehicle in the standings.
 *
 * @param {Array<Object>} standings Full standings array.
 * @returns {?Object} Focused vehicle or null.
 */
function StandingsGetFocus(standings)
{
    for (const vehicle of standings)
    {
        if (vehicle.focus)
        {
            return vehicle;
        }
    }

    return null;
}

/**
 * Finds the index of the focused vehicle in the standings.
 *
 * @param {Array<Object>} standings Full standings array.
 * @returns {number} Focused vehicle index or -1.
 */
function StandingsGetFocusIdx(standings)
{
    for (const [i, vehicle] of standings.entries())
    {
        if (vehicle.focus)
        {
            return i;
        }
    }

    return -1;
}

/**
 * Returns whether all four tires are on the same compound.
 *
 * @param {Object} vehicle Vehicle standings row.
 * @returns {boolean} True when all four tires share one compound.
 */
function HasOneTireCompound(vehicle)
{
    if (vehicle.tire_compound == null)
    {
        return false;
    }

    let result = vehicle.tire_compound[0] == vehicle.tire_compound[1] &&
                 vehicle.tire_compound[0] == vehicle.tire_compound[2] &&
                 vehicle.tire_compound[0] == vehicle.tire_compound[3];

    return result;
}

/**
 * Maps a tire compound name to its display color.
 *
 * @param {string} compound Tire compound name.
 * @returns {string} CSS color string.
 */
function TireCompoundColor(compound)
{
    switch (compound.toLowerCase())
    {
        case "soft":
        {
            return "rgba(240, 240, 240, 1.0)";
        }

        case "medium":
        {
            return "rgba(255, 208, 0, 1.0)";
        }

        case "hard":
        {
            return "rgba(215, 38, 61, 1.0)";
        }

        case "wet":
        {
            return "rgba(144, 224, 239, 1.0)";
        }

        default:
        {
            return "rgba(79, 93, 117, 1.0)";
        }
    }
}

/**
 * Finds the best sector times for one vehicle class across the full field.
 *
 * @param {Array<Object>} standings Full standings array.
 * @param {string} vehicle_class Vehicle class name.
 * @returns {{S1:number,S2:number,S3:number}} Best sector times for the class.
 */
function GetBestSectors(standings, vehicle_class)
{
    let result = { S1: -1, S2: -1, S3: -1 };
    if (standings.length < 1) return result;

    for (let i = 0; i < standings.length; ++i)
    {
        if (standings[i].vehicle_class != vehicle_class)
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
 * Formats a sector time with millisecond precision.
 *
 * @param {number} sector Sector time in seconds.
 * @returns {string} Formatted sector time or placeholder.
 */
function Sector2String(sector)
{
    if (sector <= 0.01)
    {
        return '--:---';
    }

    return sector.toFixed(3);
}

/**
 * Returns whether a sector or mini-sector time is valid.
 *
 * @param {number} time Time value in seconds.
 * @returns {boolean} True when the time is valid.
 */
function IsValidTime(time)
{
    return time > 0;
}
