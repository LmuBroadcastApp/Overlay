/**
 * Returns the vehicle currently in focus, or null if none.
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
