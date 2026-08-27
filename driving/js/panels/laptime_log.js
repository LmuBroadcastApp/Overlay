/**
 * Lap time log panel: a chart of recent lap times plus a table with the
 * last laps (lap number, time, delta to the previous lap).
 *
 * Dot colors: purple = personal best, green = faster than previous lap,
 * red = slower, red cross = invalid lap (no time registered).
 */
class LaptimeLog
{
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`LaptimeLog: Element ${selector} not found`);
            return;
        }

        this.element.style.display = 'none';
        this.stateManager.subscribe(this.handleStateChange.bind(this));

        this.canvas = this.element.querySelector('.laptime-log-chart');
        this.ctx = this.canvas.getContext('2d');

        this.maxChartLaps = 10;   /** laps shown in the chart */
        this.maxTableLaps = 3;    /** laps shown in the table */

        this.history = [];        /** { lap, time, delta, state } */
        this.lastSeenLap = null;

        this.colors =
        {
            best:    '#c518dd',
            faster:  '#51cf66',
            slower:  '#ff6b6b',
            invalid: '#ff6b6b'
        };

        this.dirty = true;
    }

    handleStateChange(key, value)
    {
        if (key !== 'standings') return;
        const vehicle = StandingsGetPlayer(value);

        if (vehicle === null)
        {
            return;
        }

        if (this.lastSeenLap === null)
        {
            /** First data: don't log laps completed before the overlay opened */
            this.lastSeenLap = vehicle.laps;
            return;
        }

        if (vehicle.laps > this.lastSeenLap)
        {
            this._logLap(vehicle.laps, vehicle.last_lap);
            this.lastSeenLap = vehicle.laps;
        }
    }

    _logLap(lap, time)
    {
        const valid = time > 0;
        const previous = [...this.history].reverse().find(e => e.state !== 'invalid');
        const bestTime = Math.min(...this.history.filter(e => e.state !== 'invalid').map(e => e.time), Infinity);

        let state = 'invalid';
        let delta = null;

        if (valid)
        {
            state = 'slower';

            if (previous)
            {
                delta = time - previous.time;
            }

            if (previous == null || time < previous.time)
            {
                state = 'faster';
            }

            if (time < bestTime)
            {
                state = 'best';
            }
        }

        this.history.push({ lap: lap, time: time, delta: delta, state: state });
        this.dirty = true;
    }

    update()
    {
        if (!this.dirty)
        {
            return;
        }

        this.dirty = false;
        this._drawChart();
        this._renderTable();
    }

    /******************************************************************************/

    _drawChart()
    {
        const { width, height } = this.canvas;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        const entries = this.history.slice(-this.maxChartLaps);
        const valid = entries.filter(e => e.state !== 'invalid');

        if (valid.length === 0)
        {
            ctx.font = '12px Titillium Web, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('waiting for laps...', width * 0.5, height * 0.5);
            return;
        }

        const padY = 14;
        const axisW = 58;
        const chartW = width - axisW;

        let minT = Math.min(...valid.map(e => e.time));
        let maxT = Math.max(...valid.map(e => e.time));

        if (maxT - minT < 0.5)
        {
            const mid = (minT + maxT) * 0.5;
            minT = mid - 0.25;
            maxT = mid + 0.25;
        }

        const timeToY = (t) => padY + ((t - minT) / (maxT - minT)) * (height - padY * 2);
        const stepX = chartW / this.maxChartLaps;
        const lapToX = (i) => stepX * 0.5 + i * stepX;

        /** For invalid laps place the dot near the bottom */
        const entryY = (e) => e.state === 'invalid' ? height - padY : timeToY(e.time);

        // dotted grid lines + axis labels
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px Titillium Web, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);

        for (let i = 0; i <= 2; i++)
        {
            const t = minT + ((maxT - minT) * 0.5) * i;
            const y = timeToY(t);

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(chartW, y);
            ctx.stroke();

            ctx.fillText(LaptimeLog.formatTime(t), chartW + 8, y);
        }

        ctx.restore();

        // axis divider
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(chartW + 2, padY * 0.5);
        ctx.lineTo(chartW + 2, height - padY * 0.5);
        ctx.stroke();

        // connecting line
        ctx.lineWidth = 2;

        for (let i = 1; i < entries.length; i++)
        {
            const x0 = lapToX(i - 1); const y0 = entryY(entries[i - 1]);
            const x1 = lapToX(i);     const y1 = entryY(entries[i]);

            const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
            gradient.addColorStop(0, this.colors[entries[i - 1].state]);
            gradient.addColorStop(1, this.colors[entries[i].state]);

            const mx = (x0 + x1) * 0.5;

            ctx.strokeStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.bezierCurveTo(mx, y0, mx, y1, x1, y1);
            ctx.stroke();
        }

        // dots
        for (let i = 0; i < entries.length; i++)
        {
            const x = lapToX(i);
            const y = entryY(entries[i]);
            const color = this.colors[entries[i].state];

            if (entries[i].state === 'invalid')
            {
                // soft glow behind invalid laps
                ctx.beginPath();
                ctx.fillStyle = 'rgba(255, 107, 107, 0.2)';
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.fillStyle = '#15151a';
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fill();

            if (entries[i].state === 'invalid')
            {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x - 2, y - 2); ctx.lineTo(x + 2, y + 2);
                ctx.moveTo(x + 2, y - 2); ctx.lineTo(x - 2, y + 2);
                ctx.stroke();
            }
        }
    }

    _renderTable()
    {
        const body = this.element.querySelector('.laptime-log-rows');
        const entries = this.history.slice(-this.maxTableLaps);

        let html = '';

        for (let i = 0; i < entries.length; i++)
        {
            const e = entries[i];
            const latest = i === entries.length - 1;

            const time = e.state === 'invalid' ? '-:--.---' : LaptimeLog.formatTime(e.time);
            const delta = (e.delta === null || e.state === 'invalid') ? '--.---' : (e.delta > 0 ? '+' : '') + e.delta.toFixed(3);
            const deltaClass = (e.delta === null || e.state === 'invalid') ? '' : (e.delta <= 0 ? 'laptime-log-delta-ok' : 'laptime-log-delta-bad');

            html += `<div class="laptime-log-row ${latest ? 'laptime-log-row-latest' : ''}">`
                 +  `<span class="laptime-log-lap">${e.lap}</span>`
                 +  `<span class="laptime-log-time">${time}</span>`
                 +  `<span class="laptime-log-delta ${deltaClass}">${delta}</span>`
                 +  `</div>`;
        }

        body.innerHTML = html;
    }

    /** Format seconds as m:ss.mmm */
    static formatTime(time)
    {
        if (time == null || time <= 0)
        {
            return '-:--.---';
        }

        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        const ms = Math.floor((time * 1000) % 1000);

        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
}
