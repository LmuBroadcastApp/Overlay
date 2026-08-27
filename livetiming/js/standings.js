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
