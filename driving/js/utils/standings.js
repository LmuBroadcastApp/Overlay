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
