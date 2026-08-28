/**
 * @fileoverview Renders the world-position track map, cars, and warning zones.
 */

/**
 * Draws the circuit map together with vehicle markers and highlighted warning areas.
 */
class TrackMapPanel
{
    /**
     * Creates a track map panel and subscribes to shared overlay state.
     * @param {string} selector CSS selector for the target canvas.
     * @param {StateManager} stateManager Shared state store.
     */
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

        this.splineOffset = null;
        this.map = null;
    }

    /**
     * Stores standings and map updates required by the renderer.
     * @param {string} key Updated state key.
     * @param {*} value Updated value.
     */
    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.standings = value;
        }
        else if (key === 'map')
        {
            this.map = value;
            this.splineOffset = null; // track changed, offset must be recomputed
        }
    }

    /**
     * Repaints the map, warning zones, and vehicle markers.
     */
    update()
    {
        let canvas = this.element;
        let ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dpr = window.devicePixelRatio || 1;

        if (this.map == null || this.map.track_map.length === 0 || this.standings == null)
        {
            return;
        }

        if (canvas.width !== this.map.size.width * dpr || canvas.height !== this.map.size.height * dpr)
        {
            canvas.height = this.map.size.height * dpr;
            canvas.width = this.map.size.width * dpr;
        }

        this._drawPitLane(ctx, this.map.pit_lane, 3, "rgba(30, 30, 30, 1)");
        this._drawPitLane(ctx, this.map.pit_lane, 1, "rgba(240, 240, 240, 1)");

        this._drawTrackMap(ctx, this.map.track_map, 6, "rgba(30, 30, 30, 1)");
        this._drawTrackMap(ctx, this.map.track_map, 3, "rgba(240, 240, 240, 1)");

        this._drawWarningZones(ctx);
        this._drawVehicles(ctx, Array.from(this.standings).reverse());
    }

    /**
     * Draws a filled vehicle marker circle.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {number} x Marker center X coordinate.
     * @param {number} y Marker center Y coordinate.
     * @param {number} radius Marker radius.
     * @param {string} color Fill color.
     */
    _drawCircle(ctx, x, y, radius, color)
    {
        ctx.strokeStyle = "black";
        ctx.fillStyle = color;
        ctx.lineWidth = 0.5;

        ctx.arc(x, y, radius, 0, 2 * Math.PI, false);

        ctx.stroke();
        ctx.fill();
    }

    /**
     * Draws a triangular marker for the leading car.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {number} cx Marker center X coordinate.
     * @param {number} cy Marker center Y coordinate.
     * @param {number} sideLength Triangle side length.
     * @param {string} color Fill color.
     * @param {number} [boderSize=0.5] Unused legacy border size parameter.
     * @param {number} [rotationDeg=180] Rotation angle in degrees.
     */
    _drawTriangle(ctx, cx, cy, sideLength, color, boderSize = 0.5, rotationDeg = 180,)
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

    /**
     * Draws the closed racing line path.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Ordered track points.
     * @param {number} size Stroke width.
     * @param {string} color Stroke color.
     */
    _drawTrackMap(ctx, points, size, color)
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
    }

    /**
     * Draws the pit-lane path.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Ordered pit-lane points.
     * @param {number} size Stroke width.
     * @param {string} color Stroke color.
     */
    _drawPitLane(ctx, points, size, color)
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
    }

    /**
     * Draws a start/finish line across the first track segment.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {{points: Array<Object>}} map Track map payload with point data.
     */
    _drawStartLine(ctx, map)
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

    /**
     * Draws a single vehicle marker and its number label.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Object} vehicles Vehicle data.
     */
    _drawVehicle(ctx, vehicles)
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
            this._drawCircle(ctx, v.world_pos.x, v.world_pos.y, point_size, c);
        }
        else
        {
            this._drawTriangle(ctx, v.world_pos.x, v.world_pos.y, point_size * 2, c,);
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

    /**
     * Draws all vehicles while ensuring the focused car is rendered last.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} vehicles Vehicles to draw.
     */
    _drawVehicles(ctx, vehicles)
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
                this._drawVehicle(ctx, vehicles[idx]);
            }
        }

        if (focus)
        {
            this._drawVehicle(ctx, focus);
        }
    }

    /**
     * Returns the index of the track point closest to a world position.
     * Needed because spline 0 does not coincide with index 0 of the track map array.
     * @param {Array<Object>} points Track points.
     * @param {{x: number, y: number}} pos Vehicle world position.
     * @returns {number} Closest track-point index.
     */
    _nearestTrackPointIndex(points, pos)
    {
        let bestIdx = 0;
        let bestDist = Infinity;

        for (let i = 0; i < points.length; ++i)
        {
            const dx = points[i].x - pos.x;
            const dy = points[i].y - pos.y;
            const dist = dx * dx + dy * dy;

            if (dist < bestDist)
            {
                bestDist = dist;
                bestIdx = i;
            }
        }

        return bestIdx;
    }

    /**
     * Computes and caches the spline-to-track-point offset for the active track.
     * The offset is derived from a real car position because spline 0 does not align
     * with track-map index 0.
     * @param {Array<Object>} points Track points.
     * @returns {number} Cached spline-to-index offset.
     */
    _getSplineOffset(points)
    {
        if (this.splineOffset !== null)
        {
            return this.splineOffset;
        }

        const n = points.length;

        for (const v of this.standings)
        {
            if (!v.world_pos || v.in_pits || !(v.spline >= 0))
            {
                continue;
            }

            const idx = this._nearestTrackPointIndex(points, v.world_pos);
            this.splineOffset = Math.round(((idx - v.spline * n) % n + n) % n);

            return this.splineOffset;
        }

        return 0; // no usable vehicle yet, retry next frame (cache stays empty)
    }

    /**
     * Strokes a highlighted arc centered around a given track index.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Track points.
     * @param {number} center Center point index.
     * @param {number} half Half-width of the highlighted section in points.
     * @param {number} size Stroke width.
     * @param {string} color Stroke color.
     */
    _strokeZone(ctx, points, center, half, size, color)
    {
        const n = points.length;
        const start = ((center - half) % n + n) % n;
        const count = half * 2;

        ctx.beginPath();
        ctx.moveTo(points[start].x, points[start].y);

        for (let i = 1; i <= count; ++i)
        {
            const p = points[(start + i) % n];
            ctx.lineTo(p.x, p.y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.stroke();
    }

    /**
     * Draws a warning zone centered on the track point nearest to the vehicle position.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Track points.
     * @param {{x: number, y: number}} worldPos Vehicle world position.
     * @param {number} size Stroke width.
     * @param {string} color Stroke color.
     */
    _drawWarningZone(ctx, points, worldPos, size, color)
    {
        const half = Math.max(1, Math.round(0.02 * points.length));
        const center = this._nearestTrackPointIndex(points, worldPos);

        this._strokeZone(ctx, points, center, half, size, color);
    }

    /**
     * Draws a warning zone from spline coordinates using the cached spline offset.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Track points.
     * @param {number} spline Vehicle spline position.
     * @param {number} size Stroke width.
     * @param {string} color Stroke color.
     */
    _drawWarningZoneBySpline(ctx, points, spline, size, color)
    {
        const n = points.length;
        const half = Math.max(1, Math.round(0.02 * n));
        const center = Math.round(this._getSplineOffset(points) + spline * n) % n;

        this._strokeZone(ctx, points, center, half, size, color);
    }

    /**
     * Draws warning zones for all flagged vehicles currently on track.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     */
    _drawWarningZones(ctx)
    {
        for (const vehicle of this.standings)
        {
            if (vehicle.show_warning_icon && !vehicle.in_pits && vehicle.world_pos)
            {
                this._drawWarningZone(ctx, this.map.track_map, vehicle.world_pos, 3, "rgb(249, 199, 79)");
                // Alternative: this._drawWarningZoneBySpline(ctx, this.map.track_map, vehicle.spline, 3, "rgb(249, 199, 79)");
            }
        }
    }
}
