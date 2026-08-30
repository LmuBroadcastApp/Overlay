/**
 * @file Color helpers for assigning vehicle class colors, matching the broadcasting overlay.
 */

/**
 * Maps a vehicle class to the fixed overlay color used across the broadcasting panels.
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