/**
 * @file Shared color helpers for assigning persistent colors to vehicle classes.
 */

const g_colorMap = new Map();

/**
 * Returns the registered color for a key, or a fallback when no color exists yet.
 *
 * @param {string} key Color map key.
 * @param {string} defaultValue Fallback CSS color string.
 * @returns {string} Registered or fallback color.
 */
function getColorDefault(key, defaultValue)
{
    return g_colorMap.has(key) ? g_colorMap.get(key) : defaultValue;
}

/**
 * Generates a random hex color.
 *
 * @returns {string} Random color in #RRGGBB format.
 */
function getRandomColor()
{
    const letters = '0123456789ABCDEF';
    let color = '#';

    for (let i = 0; i < 6; i++)
    {
        color += letters[Math.floor(Math.random() * 16)];
    }

    return color;
}

/**
 * Ensures a vehicle class has a stable generated color and returns it.
 *
 * @param {string} key Vehicle class name.
 * @returns {string} Stable color for the class.
 */
function ensureClassColor(key)
{
    if (!g_colorMap.has(key))
    {
        g_colorMap.set(key, getRandomColor());
    }

    return g_colorMap.get(key);
}
