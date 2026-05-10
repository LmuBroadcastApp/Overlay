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
        this.lineWidth = 2; this.queueCapacity = 128;
        this.vehicle = null;

        this.canvas = document.getElementById(selector.slice(1));
        this.ctx = this.canvas.getContext('2d');

        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.steering = new CircularQueue(this.queueCapacity);
        this.throttle = new CircularQueue(this.queueCapacity);
        this.brake = new CircularQueue(this.queueCapacity);
    }

    handleStateChange(key, value)
    {
        this.vehicle = this.StandingsGetFocus(value);
        if (this.vehicle == null) return;

        this.steering.enqueue((this.vehicle.telemetry.steering + 1) * 0.5);
        this.throttle.enqueue(this.vehicle.telemetry.throttle);
        this.brake.enqueue(this.vehicle.telemetry.brake);
    }

    StandingsGetFocus(standings)
    {
        for (const vehicle of standings)
        {
            if (vehicle.focus)
            {
                return vehicle;
            }
        }

        return null;
    }

    drawSteering(x, y, radius, value)
    {
        value = value * 2 - 1;
        this.ctx.font = "24px Arial";

        // outer circle
        this.ctx.beginPath();
        this.ctx.strokeStyle = "#888";
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // center point
        const angle = value * Math.PI * 1.5;  // limit to ±90°

        let indicatorX = x + Math.sin(angle) * radius * 0.8;
        let indicatorY = y - Math.cos(angle) * radius * 0.8;

        // indicator dot
        this.ctx.beginPath();
        this.ctx.fillStyle = "cyan";
        this.ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
        this.ctx.fill();

        { // Current Km/h
            const kmh = this.vehicle.telemetry.speed.toFixed(0);
            const metrics = this.ctx.measureText(kmh);
            indicatorX = x - metrics.width / 2;

            this.ctx.fillStyle = "whitesmoke";
            this.ctx.fillText(kmh, indicatorX, y);

            let fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
            y += fontHeight;
        }
        { // Current gear
            const gear = this.vehicle.telemetry.gear;
            const metrics = this.ctx.measureText(gear);
            indicatorX = x - metrics.width / 2;

            this.ctx.fillText(gear, indicatorX, y);
        }
    }

    drawBar(x, y, w, h, value, color)
    {
        // background
        this.ctx.fillStyle = "#222";
        this.ctx.fillRect(x, y, w, h);

        // filled part (bottom → up)
        const filledHeight = h * value;

        this.ctx.fillStyle = color;
        this.ctx.fillRect(x, y + (h - filledHeight), w, filledHeight);

        // border
        this.ctx.strokeStyle = "#555";
        this.ctx.strokeRect(x, y, w, h);
    }

    drawLine(data, key, color, width, height)
    {
        const stepX = width / (this.queueCapacity - 1);

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = this.lineWidth;

        data.forEach((value, i) =>
        {
            let y = height - (value * height);
            const x = i * stepX;

            if (y < this.lineWidth)
            {
                y = this.lineWidth;
            }

            if (y > height - this.lineWidth)
            {
                y = height - this.lineWidth;
            }

            if (i === 0)
            {
                this.ctx.moveTo(x + 5, y);
            }
            else
            {
                this.ctx.lineTo(x, y);
            }
        });

        this.ctx.stroke();
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
            return
        }

        {
            let y = height * 0.5 - this.lineWidth;
            let x = width - y;
            let r = y;

            this.drawSteering(x, y, r, (this.vehicle.telemetry.steering + 1) * 0.5);
            width -= (height + this.lineWidth);
        }

        {
            const barWidth = height * 0.1;

            this.drawBar(width - barWidth, 0, barWidth, height, this.vehicle.telemetry.brake, "red");
            this.drawBar(width - barWidth * 2 - barWidth * 0.5, 0, barWidth, height, this.vehicle.telemetry.throttle, "green");

            width -= barWidth * 3;
        }

        {
            this.drawLine(this.throttle.toArray(), 'throttle', 'green', width, height);
            this.drawLine(this.steering.toArray(), 'steering', 'gray', width, height);
            this.drawLine(this.brake.toArray(), 'brake', 'red', width, height);
        }
    }
}
