function float2int (value)
{
    return value | 0;
}

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

function GetTotalRaceLaps(vehicle, trackDistance, raceTime)
{
    let travelled_distance = vehicle.spline * trackDistance;
    let travelled_time = vehicle.current_lap;

    let avg_speed = travelled_distance / travelled_time;
    let total_distance = avg_speed * raceTime;

    const laps = total_distance / trackDistance;
    return laps.toFixed(1);
}

function GetTotalRaceLaps(standings, raceTime)
{
    let laps = raceTime / GetLapTimeForTotalRaceLaps(standings);
    return laps <= 0 ? "-" : (laps + standings[0].laps + 1).toFixed(1);
}

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

function CSSClassFromVehicleClass(className)
{
    let cls = (className || '').replace(/[^a-zA-Z0-9]/g, '_');
    return ClassExists(cls) ? cls : 'generic-class';
}

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

function Sector2String(sector)
{
    if (sector <= 0.01)
    {
        return '--:---';
    }

    return sector.toFixed(3);
}

function IsValidTime(time)
{
    return time > 0;
}