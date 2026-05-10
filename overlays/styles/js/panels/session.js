class SessionPanel
{
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

    handleStateChange(key, value)
    {
        if (key === 'session')
        {
            this.session = value.trackName !== "" ? value : null;
        }
    }

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
                sector += `<div class="sector-flag" ">S${i + 1}</div>`;
            }
        }

        this.element.querySelector('.in-game-time').textContent = this.getInGameTImeString(this.session);
        this.element.querySelector('.session-flag').innerHTML = sector || "";
    }

    getInGameTImeString(session)
    {
        let time = session.inGameTime;

        let hours = Math.floor(time / 3600);
        time %= 3600;

        let minutes = Math.floor(time / 60);
        let seconds = time % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

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
