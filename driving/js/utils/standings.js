/**
 * Returns the vehicle currently in focus, or null if none.
 * @param {Array<Object>} standings Current standings snapshot.
 * @returns {Object|null} Focused vehicle or null.
 */
function StandingsGetFocus(standings)
{
    for (let i = 0; i < standings.length; ++i)
    {
        if (standings[i].focus)
        {
            return standings[i];
        }
    }

    return null;
}

/**
 * Returns the vehicle of the player, or null if none.
 * @param {Array<Object>} standings Current standings snapshot.
 * @returns {Object|null} Player vehicle or null.
 */
function StandingsGetPlayer(standings)
{
    for (let i = 0; i < standings.length; ++i)
    {
        if (standings[i].is_player)
        {
            return standings[i];
        }
    }

    return null;
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
