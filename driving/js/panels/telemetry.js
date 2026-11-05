/**
 * @fileoverview Renders the driving telemetry chart panel and its rolling input history.
 */

/**
 * Fixed-size circular queue used to keep recent telemetry samples.
 */
class CircularQueue
{
    /**
     * Creates a queue with a fixed maximum capacity.
     * @param {number} capacity Maximum number of items to retain.
     */
    constructor(capacity)
    {
        this.buffer = new Array(capacity);
        this.capacity = capacity;

        this.head = 0;
        this.tail = -1;
        this.count = 0;
    }

    /**
     * Clears the queue contents.
     */
    reset()
    {
        this.head = 0;
        this.tail = -1;
        this.count = 0;
    }

    /**
     * Pre-fills the queue with the same value.
     * @param {*} value Initial value used for every slot.
     */
    fill(value)
    {
        this.buffer.fill(value);
        this.count = this.capacity;

        this.head = 0;
        this.tail = this.capacity - 1;
    }

    /**
     * Appends one value, discarding the oldest when at capacity.
     * @param {*} value Value to enqueue.
     */
    enqueue(value)
    {
        this.tail = (this.tail + 1) % this.capacity;
        this.buffer[this.tail] = value;

        if (this.count === this.capacity)
        {
            this.head = (this.head + 1) % this.capacity;
        }
        else
        {
            this.count++;
        }
    }

    /**
     * Returns the queue contents in logical order.
     * @returns {Array<*>} Queue contents from oldest to newest.
     */
    toArray()
    {
        const result = [];

        for (let i = 0; i < this.count; i++)
        {
            const index = (this.head + i) % this.capacity;
            result.push(this.buffer[index]);
        }

        return result;
    }

    /**
     * Copies the queue contents into a caller-provided array (avoids per-frame allocation).
     * The target array must have at least as many slots as the queue has items.
     * @param {Array<*>} target Destination array.
     * @returns {Array<*>} The target array, for chaining.
     */
    copyTo(target)
    {
        for (let i = 0; i < this.count; i++)
        {
            target[i] = this.buffer[(this.head + i) % this.capacity];
        }

        return target;
    }
}

/**
 * Displays steering, throttle, brake, RPM, speed, and gear input traces.
 */
class TelemetryChart
{
    /**
     * Creates a telemetry chart panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the target canvas.
     * @param {StateManager} stateManager Shared state store.
     */
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
        this.scale = 1;

        // reused per-frame scratch buffer for chart traces
        this.chartBuffer = new Array(this.queueCapacity);

        // cached style/dpr values and redraw bookkeeping
        this._frameCount = 0;
        this._dirty = false;

        this._cssHeight = undefined;
        this._cssWidth = undefined;

        this._scale = undefined;
        this._dpr = undefined;

        this.canvas = document.getElementById(selector.slice(1));
        this.ctx = this.canvas.getContext('2d');

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.steering = new CircularQueue(this.queueCapacity);
        this.steering.fill(0);

        this.throttle = new CircularQueue(this.queueCapacity);
        this.throttle.fill(0);

        this.brake = new CircularQueue(this.queueCapacity);
        this.brake.fill(0);

        this.colors =
        {
            throttle: { line: '#51cf66', fill: 'rgba(81, 207, 102, 0.12)' },
            brake:    { line: '#ff6b6b', fill: 'rgba(255, 107, 107, 0.12)' },
            steering: { line: 'rgba(110, 231, 255, 0.5)', fill: 'rgba(110, 231, 255, 0.05)' },
        };
    }

    /**
     * Stores focused-car telemetry samples from standings updates.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.vehicle = StandingsGetFocus(value);
            if (this.vehicle == null) return;

            this.steering.enqueue((this.vehicle.telemetry.steering + 1) * 0.5);
            this.throttle.enqueue(this.vehicle.telemetry.throttle);
            this.brake.enqueue(this.vehicle.telemetry.brake);

            this._dirty = true;
        }
        else if (key === 'overlay_settings')
        {
            this.scale = value.driving_telemetry.scale;
        }
    }

    /**
     * Resizes and redraws the telemetry chart for the current frame.
     */
    update()
    {
        const dpr = window.devicePixelRatio || 1;
        const scale = this.scale;

        // Cache chart CSS size/dpr; only re-read when scale or dpr change, the buffer
        // falls out of sync, or once a second as a safety net for external CSS changes.
        if (this._dpr !== dpr || this._scale !== scale || this._cssWidth === undefined || ++this._frameCount % 60 === 0 || this.canvas.width !== Math.round(this._cssWidth * this._dpr) || this.canvas.height !== Math.round(this._cssHeight * this._dpr))
        {
            const style = getComputedStyle(document.documentElement);

            this._cssHeight = parseInt(style.getPropertyValue('--telemetry-input-chart-height')) * scale;
            this._cssWidth = parseInt(style.getPropertyValue('--telemetry-input-chart-width')) * scale;

            this._scale = scale;
            this._dpr = dpr;
        }

        const cssHeight = this._cssHeight;
        const cssWidth = this._cssWidth;

        const pixelHeight = Math.round(cssHeight * dpr);
        const pixelWidth = Math.round(cssWidth * dpr);

        // Only resize when needed: resizing clears the canvas and resets context state
        if (this.canvas.height !== pixelHeight || this.canvas.width !== pixelWidth)
        {
            this.canvas.height = pixelHeight;
            this.canvas.width = pixelWidth;

            this.canvas.style.height = cssHeight + 'px';
            this.canvas.style.width = cssWidth + 'px';

            this._dirty = true;
        }

        // Skip redraw while nothing changed (no new sample and no resize).
        if (this.vehicle == null || !this._dirty)
        {
            return;
        }

        this._dirty = false;

        let width = cssWidth;
        let height = cssHeight;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.clearRect(0, 0, width, height);

        // padding
        const pad = 0;
        const shiftLightHeight = 12 * scale;
        height -= pad * 2 + shiftLightHeight;
        let drawY = pad + shiftLightHeight;

        // Full-width shift lights keep the RPM signal visible across the entire panel.
        this._drawShiftLightBar(width * 0.5, pad, width, scale);

        // steering wheel (right side)
        {
            // Keep a compact outer margin while allowing the steering dial to use
            // more of the available telemetry height.
            const gaugeRadius = 1;
            const r = (height - gaugeRadius * 2) * 0.5 - this.lineWidth;
            const cx = width - r - gaugeRadius - pad - 4;
            const cy = drawY + height * 0.5 - 2 * scale;

            this._drawSteering(cx, cy, r, (this.vehicle.telemetry.steering + 1) * 0.5, scale);
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

            this.steering.copyTo(this.chartBuffer);
            this._drawLine(this.chartBuffer, this.colors.steering.line, this.colors.steering.fill, chartX, drawY, chartW, height);

            this.brake.copyTo(this.chartBuffer);
            this._drawLine(this.chartBuffer, this.colors.brake.line, this.colors.brake.fill, chartX, drawY, chartW, height);

            this.throttle.copyTo(this.chartBuffer);
            this._drawLine(this.chartBuffer, this.colors.throttle.line, this.colors.throttle.fill, chartX, drawY, chartW, height);
        }
    }

    /**
     * Draws the chart background grid.
     * @param {number} x Grid origin X coordinate.
     * @param {number} y Grid origin Y coordinate.
     * @param {number} w Grid width.
     * @param {number} h Grid height.
     */
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

    /**
     * Draws a continuous shift-light bar above the steering widget.
     * The bar fills with RPM (as a fraction of max RPM) and colors shift from
     * green (0-75%) through yellow-to-red (75-90%) and red-to-blue (90-100%).
     * @param {number} x Bar center X coordinate.
     * @param {number} y Bar top coordinate.
     * @param {number} width Shift-light bar width.
     * @param {number} scale UI scale factor applied to dimensions.
     */
    _drawShiftLightBar(x, y, width, scale)
    {
        const maxRpm = this.vehicle.telemetry.max_rpm;
        if (maxRpm <= 0) return;

        const ratio = Math.min(Math.max(this.vehicle.telemetry.rpm / maxRpm, 0), 1);

        const barHeight = 8 * scale;
        const radius = 3 * scale;
        const barX = x - width * 0.5;

        this.ctx.save();

        // background track
        this.ctx.beginPath();
        this.ctx.roundRect(barX, y, width, barHeight, radius);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.fill();

        if (ratio <= 0)
        {
            this.ctx.restore();
            return;
        }

        // color zones across the full bar: green -> yellow -> red -> blue
        const gradient = this.ctx.createLinearGradient(barX, 0, barX + width, 0);
        gradient.addColorStop(0.0, '#51cf66')
        gradient.addColorStop(0.7, '#51cf66');
        gradient.addColorStop(0.8, '#ffd43b');
        gradient.addColorStop(0.9, '#ff6b6b');
        gradient.addColorStop(1.0, '#339af0');

        const fillWidth = width * ratio;

        // soft glow behind the filled portion
        this.ctx.globalAlpha = 0.3;
        this.ctx.beginPath();
        this.ctx.roundRect(barX - 2, y - 2, fillWidth + 4, barHeight + 4, radius + 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        this.ctx.globalAlpha = 1;
        this.ctx.beginPath();
        this.ctx.roundRect(barX, y, fillWidth, barHeight, radius);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * Draws the steering indicator, speed, gear, and RPM ring.
     * @param {number} x Widget center X coordinate.
     * @param {number} y Widget center Y coordinate.
     * @param {number} radius Steering ring radius.
     * @param {number} value Normalized steering value in the [0, 1] range.
     * @param {number} scale UI scale factor applied to text sizes.
     */
    _drawSteering(x, y, radius, value, scale = 1)
    {
        value = value * 2 - 1;
        this.ctx.save();

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

        // steering indicator arc
        const angle = value * Math.PI * 1.5;
        const indicatorX = x + Math.sin(angle) * radius;
        const indicatorY = y - Math.cos(angle) * radius;

        // dot
        this.ctx.beginPath();
        this.ctx.fillStyle = '#6ee7ff';
        this.ctx.arc(indicatorX, indicatorY, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // speed
        const kmh = this.vehicle.telemetry.speed.toFixed(0);
        this.ctx.font = `bold ${25 * scale}px Titillium Web, sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(kmh, x, y - 12 * scale);

        // "km/h" label
        this.ctx.font = `${12 * scale}px Titillium Web, sans-serif`;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.fillText('km/h', x, y + 5 * scale);

        // gear
        const gear = this.vehicle.telemetry.gear;
        this.ctx.font = `bold ${24 * scale}px Titillium Web, sans-serif`;
        this.ctx.fillStyle = gear < 0 ? '#ff6b6b' : gear == 0 ? '#ffffff' : '#71e2d0';
        this.ctx.fillText(gear < 0 ? 'R' : gear == 0 ? 'N' : gear, x, y + 25 * scale);

        this.ctx.restore();
    }

    /**
     * Draws a vertical telemetry bar for brake or throttle.
     * @param {number} x Bar origin X coordinate.
     * @param {number} y Bar origin Y coordinate.
     * @param {number} w Bar width.
     * @param {number} h Bar height.
     * @param {number} value Filled ratio in the [0, 1] range.
     * @param {string} color Fill color.
     * @param {string} glowColor Glow highlight color.
     */
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

            // fake glow: stacked translucent fills (cheaper than shadowBlur)
            this.ctx.beginPath();
            this.ctx.roundRect(x - 3, fy, w + 6, filled, radius);
            this.ctx.fillStyle = glowColor;
            this.ctx.globalAlpha = 0.2;
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.roundRect(x - 1, fy, w + 2, filled, radius);
            this.ctx.globalAlpha = 0.35;
            this.ctx.fill();

            this.ctx.globalAlpha = 1;

            this.ctx.beginPath();
            this.ctx.roundRect(x, fy, w, filled, radius);
            this.ctx.fillStyle = color;
            this.ctx.fill();

            // bright top cap
            this.ctx.beginPath();
            this.ctx.roundRect(x, fy, w, Math.min(filled, 4), [radius, radius, 0, 0]);
            this.ctx.fillStyle = glowColor;
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    /**
     * Draws one telemetry trace and its filled area.
     * @param {Array<number>} data Normalized data points.
     * @param {string} color Stroke color.
     * @param {string} fillColor Area fill color.
     * @param {number} chartX Chart origin X coordinate.
     * @param {number} chartY Chart origin Y coordinate.
     * @param {number} chartW Chart width.
     * @param {number} chartH Chart height.
     */
    _drawLine(data, color, fillColor, chartX, chartY, chartW, chartH)
    {
        if (data.length < 2)
        {
            return;
        }

        const stepX = chartW / (this.queueCapacity - 1);
        this.ctx.save();

        // fill area under curve
        this.ctx.beginPath();
        this.ctx.moveTo(chartX, chartY + chartH);

        for (let i = 0; i < data.length; i++)
        {
            let cy = chartH - (data[i] * chartH);
            cy = Math.max(this.lineWidth, Math.min(chartH - this.lineWidth, cy));

            this.ctx.lineTo(chartX + i * stepX, chartY + cy);
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
                this.ctx.moveTo(chartX + i * stepX, chartY + cy);
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
