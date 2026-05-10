class TrackMapPanel
{
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`TrackMapPanel: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.standings = null;
        this.map = null;
    }

    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.standings = value;
        }
        else if (key === 'map')
        {
            this.map = value;
        }
    }

    clear()
    {
        this.element.getContext("2d").clearRect(0, 0, this.element.width, this.element.height);
    }

    drawCircle(ctx, x, y, radius, color)
    {
        ctx.strokeStyle = "black";
        ctx.fillStyle = color;
        ctx.lineWidth = 0.5;

        ctx.arc(x, y, radius, 0, 2 * Math.PI, false);

        ctx.stroke();
        ctx.fill();
    }

    drawTriangle(ctx, cx, cy, sideLength, color, boderSize = 0.5, rotationDeg = 180,)
    {
        ctx.strokeStyle = "black";
        ctx.fillStyle = color;
        ctx.lineWidth = 0.5;

        const h = (Math.sqrt(3) / 2) * sideLength;
        const rot = (rotationDeg * Math.PI) / 180;

        const verts = [
            { x:               0, y: -2 * h / 3 }, // top vertex
            { x: -sideLength / 2, y:      h / 3 }, // bottom‑left
            { x:  sideLength / 2, y:      h / 3 }, // bottom‑right
        ];

        verts.forEach((v, i) =>
        {
            const xr = v.x * Math.cos(rot) - v.y * Math.sin(rot);
            const yr = v.x * Math.sin(rot) + v.y * Math.cos(rot);
            const px = cx + xr;
            const py = cy + yr;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });

        ctx.fill();
        ctx.stroke();
    }

    drawTrackMap(ctx, points, size, color)
    {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; ++i)
        {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();

        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.stroke();

        //ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        //ctx.fill();
    }

    drawPitLane(ctx, points, size, color)
    {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; ++i)
        {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.stroke();

        //ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        //ctx.fill();
    }

    drawStartLine(ctx, map)
    {
        const A = map.points[  0];
        const B = map.points[100];

        const dx = B.x - A.x;
        const dy = B.y - A.y;

        const len = Math.hypot(dx, dy);

        const ux = dx / len;
        const uy = dy / len;

        const px =  uy;   // swap and change sign
        const py = -ux;

        const perpLength = 15;          // adjust as you like
        const half = perpLength / 2;    // we will go ±half from the midpoint

        const mx = map.points[0].x;
        const my = map.points[0].y;

        const P1 = { x: mx + px * half, y: my + py * half };
        const P2 = { x: mx - px * half, y: my - py * half };

        ctx.strokeStyle = 'rgb(250, 150, 150)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(P1.x, P1.y);
        ctx.lineTo(P2.x, P2.y);
        ctx.stroke();
    }

    drawVehicle(ctx, vehicles)
    {
        let v = vehicles;

        let x = v.world_pos.x;
        let y = v.world_pos.y;

        let metrics = ctx.measureText(v.vehicle_number);
        let c = ColorFromVehicleClass(v.vehicle_class);

        let rect_extra = 5;
        let point_size = 7;

        let textWidth = metrics.width + rect_extra;
        let textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + rect_extra;

        let rect_start_x = x - textWidth / 2 - rect_extra * 0.5;
        let rect_start_y = y - textHeight * 2 + rect_extra * 0.5;

        let text_start_x = x - textWidth / 2;
        let text_start_y = y - textHeight;

        if (v.focus)
        {
            c = "rgb(240, 240, 240)";
            point_size += 3;
        }

        if (v.in_pits)
        {
            point_size *= 0.6;
            let rgb = c.replace(/[^\d,]/g, "").split(",");
            c = `rgba(${rgb[0] - 50}, ${rgb[1] - 50}, ${rgb[2] - 50}, 0.8)`;
        }

        ctx.beginPath();

        if (v.race_position > 1)
        {
            this.drawCircle(ctx, v.world_pos.x, v.world_pos.y, point_size, c);
        }
        else
        {
            this.drawTriangle(ctx, v.world_pos.x, v.world_pos.y, point_size * 2, c,);
        }

        if (!v.in_pits)
        {
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(rect_start_x, rect_start_y, textWidth, textHeight);

            ctx.font = "bold";
            ctx.fillStyle = "rgb(255, 255, 255)";
            ctx.fillText(v.vehicle_number, text_start_x, text_start_y);
        }
    }

    drawVehicles(ctx, vehicles)
    {
        vehicles.sort((a, b) => (b.in_pits - a.in_pits));
        let focus = null;

        for (let idx in vehicles)
        {
            if (vehicles[idx].focus)
            {
                focus = vehicles[idx];
            }
            else
            {
                this.drawVehicle(ctx, vehicles[idx]);
            }
        }

        if (focus)
        {
            this.drawVehicle(ctx, focus);
        }
    }

    update()
    {
        let canvas = this.element;
        let ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dpr = window.devicePixelRatio || 1;

        if (this.map == null || this.standings == null)
        {
            return;
        }

        if (canvas.width !== this.map.size.width * dpr || canvas.height !== this.map.size.height * dpr)
        {
            canvas.height = this.map.size.height * dpr;
            canvas.width = this.map.size.width * dpr;
        }

        this.drawPitLane(ctx, this.map.pit_lane, 3, "rgba(30, 30, 30, 1)");
        this.drawPitLane(ctx, this.map.pit_lane, 1, "rgba(240, 240, 240, 1)");

        this.drawTrackMap(ctx, this.map.track_map, 6, "rgba(30, 30, 30, 1)");
        this.drawTrackMap(ctx, this.map.track_map, 3, "rgba(240, 240, 240, 1)");

        this.drawVehicles(ctx, Array.from(this.standings).reverse());

        //this.drawStartLine(ctx, map);

        //for (const [key, value] of GetByClasses(Array.from(this.standings).reverse()))
        //{
        //    this.drawVehicles(ctx, value);
        //}
    }
}
