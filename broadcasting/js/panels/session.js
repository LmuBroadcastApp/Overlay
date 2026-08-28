/**
 * @fileoverview Renders the broadcasting session header with timing and flag state.
 */

/**
 * Displays track, session, countdown, in-game time, and flagged sectors.
 */
class SessionPanel
{
    /**
     * Creates a session panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the panel root element.
     * @param {StateManager} stateManager Shared state store.
     */
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`SessionPanel: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.session = null;
    }

    /**
     * Stores the latest session payload.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'session')
        {
            this.session = value.trackName !== "" ? value : null;
        }
    }

    /**
     * Refreshes the visible session header values.
     */
    update()
    {
        if (this.session === null) return;
        let sector = "";

        this.element.querySelector('.session-time').textContent = this.getSessionTimeString(this.session);
        this.element.querySelector('.session-track').textContent = this.session.trackName;
        this.element.querySelector('.session-name').textContent = this.session.name;

        for (var i = 0; i < this.session.sectorFlags.length; i++)
        {
            if (this.session.sectorFlags[i])
            {
                sector += `<div class="sector-flag">S${i + 1}</div>`;
            }
        }

        this.element.querySelector('.in-game-time').textContent = this.getInGameTImeString(this.session);
        this.element.querySelector('.session-flag').innerHTML = sector || "";
    }

    /**
     * Formats the current in-game clock for display.
     * @param {Object} session Session payload.
     * @returns {string} Formatted in-game time string.
     */
    getInGameTImeString(session)
    {
        let time = session.inGameTime;

        let hours = Math.floor(time / 3600);
        time %= 3600;

        let minutes = Math.floor(time / 60);
        let seconds = time % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Formats the remaining session time as HH:MM:SS.
     * @param {Object} session Session payload.
     * @returns {string} Formatted remaining time string.
     */
    getSessionTimeString(session)
    {
        let remaining = Math.floor(session.endEventTime - session.currentEventTime);
        remaining = Math.max(0, remaining);

        let hours = Math.floor(remaining / 3600);
        remaining %= 3600;

        let minutes = Math.floor(remaining / 60);
        let seconds = remaining % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}
