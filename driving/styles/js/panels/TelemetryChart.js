class CircularQueue
{
    constructor(capacity)
    {
        this.buffer = new Array(capacity);
        this.capacity = capacity;

        this.head = 0;
        this.tail = -1;
        this.count = 0;
    }

    enqueue(value)
    {
        this.buffer[this.tail] = value;
        this.tail = (this.tail + 1) % this.capacity;

        if (this.count === this.capacity)
        {
            this.head = (this.head + 1) % this.capacity;
        }
        else
        {
            this.count++;
        }
    }

    toArray()
    {
        const result = [];

        for (let i = 0; i < this.count - 1; i++)
        {
            const index = (this.head + i) % this.capacity;
            result.push(this.buffer[index]);
        }

        return result;
    }
}

class TelemetryChart
{
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`TelemetryChart: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.vehicle = null;

        this.queueCapacity = 512;
        this.lineWidth = 2;

        this.canvas = document.getElementById(selector.slice(1));
        this.ctx = this.canvas.getContext('2d');

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.steering = new CircularQueue(this.queueCapacity);
        this.throttle = new CircularQueue(this.queueCapacity);
        this.brake = new CircularQueue(this.queueCapacity);

        this.colors = {
            throttle: { line: '#51cf66', fill: 'rgba(81, 207, 102, 0.12)' },
            brake:    { line: '#ff6b6b', fill: 'rgba(255, 107, 107, 0.12)' },
            steering: { line: 'rgba(110, 231, 255, 0.5)', fill: 'rgba(110, 231, 255, 0.05)' },
        };
    }

    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.vehicle = this._StandingsGetFocus(value);
            if (this.vehicle == null) return;

            this.steering.enqueue((this.vehicle.telemetry.steering + 1) * 0.5);
            this.throttle.enqueue(this.vehicle.telemetry.throttle);
            this.brake.enqueue(this.vehicle.telemetry.brake);
        }
    }

    update()
    {
        const cssHeight = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-input-chart-height');
        const cssWidth = getComputedStyle(document.documentElement).getPropertyValue('--telemetry-input-chart-width');

        this.canvas.height = parseInt(cssHeight);
        this.canvas.width = parseInt(cssWidth);

        let { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);

        if (this.vehicle == null)
        {
            return;
        }

        // padding
        const pad = 0;
        height -= pad * 2;
        let drawY = pad;

        // steering wheel (right side)
        {
            const gaugeRadius = 15;
            const r = (height - gaugeRadius * 2) * 0.5 - this.lineWidth;
            const cx = width - r - gaugeRadius - pad - 4;
            const cy = drawY + r + gaugeRadius + 4;

            this._drawSteering(cx, cy, r, (this.vehicle.telemetry.steering + 1) * 0.5);
            width -= (r * 2 + gaugeRadius * 2 + pad + 12);
        }

        // bars (between chart and steering)
        {
            const barW = Math.max(10, height * 0.08);
            const gap = 4;

            this._drawBar(width - barW - pad, drawY, barW, height, this.vehicle.telemetry.brake, '#ff6b6b', 'rgba(255, 107, 107, 0.5)');
            this._drawBar(width - barW * 2 - gap - pad, drawY, barW, height, this.vehicle.telemetry.throttle, '#51cf66', 'rgba(81, 207, 102, 0.5)');

            width -= (barW * 2 + gap + pad);
        }

        // chart area
        {
            const chartX = pad;
            const chartW = width - pad * 2;

            this._drawGrid(chartX, drawY, chartW, height);

            this._drawLine(this.steering.toArray(), this.colors.steering.line, this.colors.steering.fill, chartX, drawY, chartW, height);
            this._drawLine(this.brake.toArray(), this.colors.brake.line, this.colors.brake.fill, chartX, drawY, chartW, height);
            this._drawLine(this.throttle.toArray(), this.colors.throttle.line, this.colors.throttle.fill, chartX, drawY, chartW, height);
        }
    }

    _StandingsGetFocus(standings)
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

    _drawGrid(x, y, w, h)
    {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        this.ctx.lineWidth = 1;

        for (let i = 1; i < 4; i++)
        {
            const gy = y + (h / 4) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, gy);
            this.ctx.lineTo(x + w, gy);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    _drawRpmGauge(x, y, radius)
    {
        if (this.vehicle.telemetry.max_rpm <= 0) return;

        const rpmRatio = Math.min(this.vehicle.telemetry.rpm / this.vehicle.telemetry.max_rpm, 1);
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 0.25;
        const totalSweep = (2 * Math.PI) - (startAngle - endAngle);
        const segments = 60;

        this.ctx.save();

        // background arc
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, startAngle, 2 * Math.PI + endAngle);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        this.ctx.lineWidth = 5;
        this.ctx.stroke();

        // colored segments up to current RPM
        const filledSweep = totalSweep * rpmRatio;
        const segmentSweep = totalSweep / segments;
        const filledSegments = Math.floor(filledSweep / segmentSweep);

        for (let i = 0; i < filledSegments; i++)
        {
            const t = i / segments;
            const segStart = startAngle + i * segmentSweep;
            const segEnd = segStart + segmentSweep + 0.005;

            let r, g, b;
            if (t < 0.6)
            {
                // green to yellow
                const lt = t / 0.6;
                r = Math.round(81 + (255 - 81) * lt);
                g = Math.round(207 + (212 - 207) * lt);
                b = Math.round(102 + (59 - 102) * lt);
            }
            else
            {
                // yellow to red
                const lt = (t - 0.6) / 0.4;
                r = 255;
                g = Math.round(212 - 105 * lt);
                b = Math.round(59 - 59 * lt);
            }

            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, segStart, segEnd);
            this.ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
            this.ctx.lineWidth = 5;
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }

        // glow on leading edge
        if (filledSegments > 0)
        {
            const glowT = filledSegments / segments;
            let gr, gg, gb;
            if (glowT < 0.6)
            {
                const lt = glowT / 0.6;
                gr = Math.round(81 + (255 - 81) * lt);
                gg = Math.round(207 + (212 - 207) * lt);
                gb = Math.round(102 + (59 - 102) * lt);
            }
            else
            {
                gr = 255;
                gg = Math.round(212 - 105 * ((glowT - 0.6) / 0.4));
                gb = Math.round(59 - 59 * ((glowT - 0.6) / 0.4));
            }

            const glowAngle = startAngle + filledSweep;
            const gx = x + Math.cos(glowAngle) * radius;
            const gy = y + Math.sin(glowAngle) * radius;

            this.ctx.beginPath();
            this.ctx.fillStyle = `rgba(${gr}, ${gg}, ${gb}, 0.4)`;
            this.ctx.arc(gx, gy, 6, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    _drawSteering(x, y, radius, value)
    {
        value = value * 2 - 1;
        this.ctx.save();

        // RPM gauge — outermost ring
        this._drawRpmGauge(x, y, radius + 10);

        // outer ring — subtle glow
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(110, 231, 255, 0.15)';
        this.ctx.lineWidth = 6;
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // outer ring — main
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        this.ctx.lineWidth = 2;
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // inner ring
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        this.ctx.lineWidth = 1;
        this.ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
        this.ctx.stroke();

        // center crosshair
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        this.ctx.beginPath();
        this.ctx.moveTo(x - radius * 0.3, y);
        this.ctx.lineTo(x + radius * 0.3, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - radius * 0.3);
        this.ctx.lineTo(x, y + radius * 0.3);
        this.ctx.stroke();

        // steering indicator arc
        const angle = value * Math.PI * 1.5;
        const indicatorX = x + Math.sin(angle) * radius * 0.8;
        const indicatorY = y - Math.cos(angle) * radius * 0.8;

        // glow
        this.ctx.beginPath();
        this.ctx.fillStyle = 'rgba(110, 231, 255, 0.3)';
        this.ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
        this.ctx.fill();

        // dot
        this.ctx.beginPath();
        this.ctx.fillStyle = '#6ee7ff';
        this.ctx.arc(indicatorX, indicatorY, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // speed
        const kmh = this.vehicle.telemetry.speed.toFixed(0);
        this.ctx.font = 'bold 20px Titillium Web, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(kmh, x, y - 4);

        // "km/h" label
        this.ctx.font = '9px Titillium Web, sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.fillText('km/h', x, y + 12);

        // gear
        const gear = this.vehicle.telemetry.gear;
        this.ctx.font = 'bold 14px Titillium Web, sans-serif';
        this.ctx.fillStyle = gear < 0 ? '#ff6b6b' : '#6ee7ff';
        this.ctx.fillText(gear < 0 ? 'R' : gear, x, y + 26);

        this.ctx.restore();
    }

    _drawBar(x, y, w, h, value, color, glowColor)
    {
        const radius = 3;

        this.ctx.save();

        // background track
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, radius);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        this.ctx.fill();

        // filled portion (bottom up)
        const filled = h * value;
        if (filled > 0)
        {
            const fy = y + (h - filled);

            // glow behind bar
            this.ctx.shadowColor = glowColor;
            this.ctx.shadowBlur = 10;

            this.ctx.beginPath();
            this.ctx.roundRect(x, fy, w, filled, radius);
            this.ctx.fillStyle = color;
            this.ctx.fill();

            this.ctx.shadowBlur = 0;

            // bright top cap
            this.ctx.beginPath();
            this.ctx.roundRect(x, fy, w, Math.min(filled, 4), [radius, radius, 0, 0]);
            this.ctx.fillStyle = glowColor;
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    _drawLine(data, color, fillColor, chartX, chartY, chartW, chartH)
    {
        if (data.length < 2) return;

        const stepX = chartW / (this.queueCapacity - 1);

        this.ctx.save();

        // fill area under curve
        this.ctx.beginPath();
        this.ctx.moveTo(chartX + 5, chartY + chartH);

        for (let i = 0; i < data.length; i++)
        {
            let cy = chartH - (data[i] * chartH);
            cy = Math.max(this.lineWidth, Math.min(chartH - this.lineWidth, cy));

            if (i === 0)
            {
                this.ctx.lineTo(chartX + 5, chartY + cy);
            }
            else
            {
                this.ctx.lineTo(chartX + i * stepX, chartY + cy);
            }
        }

        this.ctx.lineTo(chartX + (data.length - 1) * stepX, chartY + chartH);
        this.ctx.closePath();
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();

        // stroke line
        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.5;

        for (let i = 0; i < data.length; i++)
        {
            let cy = chartH - (data[i] * chartH);
            cy = Math.max(this.lineWidth, Math.min(chartH - this.lineWidth, cy));

            if (i === 0)
            {
                this.ctx.moveTo(chartX + 5, chartY + cy);
            }
            else
            {
                this.ctx.lineTo(chartX + i * stepX, chartY + cy);
            }
        }

        this.ctx.stroke();
        this.ctx.restore();
    }
}
