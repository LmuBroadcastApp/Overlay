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
            this.splineOffset = null;
        }
    }

    /**
     * Returns a dark-theme color palette for canvas drawing.
     * @returns {Object} Canvas color palette.
     */
    _palette()
    {
        return {
            glow:       'rgba(240, 241, 245, 0.18)',
            casing:     '#0a0a12',
            surface:    '#565b69',
            centerline: 'rgba(240, 241, 245, 0.55)',
            pit:        'rgba(150, 155, 170, 0.85)',
            labelBg:    'rgba(0, 0, 0, 0.65)',
            labelText:  '#f0f1f5',
            ring:       '#f0f1f5',
            warning:    'rgb(249, 199, 79)'
        };
    }

    /**
     * Repaints the map, warning zones, and vehicle markers.
     */
    update()
    {
        let canvas = this.element;
        let ctx = canvas.getContext("2d");

        if (this.map == null || this.map.track_map.length === 0 || this.standings == null)
        {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const w = this.map.size.width;
        const h = this.map.size.height;

        if (canvas.width !== w * dpr || canvas.height !== h * dpr)
        {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const colors = this._palette();

        this._drawPitLane(ctx, this.map.pit_lane, colors);
        this._drawTrack(ctx, this.map.track_map, colors);

        this._drawWarningZones(ctx);
        this._drawVehicles(ctx, Array.from(this.standings).reverse(), colors);
    }

    /**
     * Traces a smooth quadratic Bézier path through the given points.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Ordered path points.
     * @param {boolean} closed Whether the path should be closed.
     */
    _tracePath(ctx, points, closed)
    {
        const n = points.length;
        const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

        ctx.beginPath();

        if (closed)
        {
            const start = mid(points[n - 1], points[0]);
            ctx.moveTo(start.x, start.y);

            for (let i = 0; i < n; ++i)
            {
                const p = points[i];
                const m = mid(p, points[(i + 1) % n]);
                ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
            }

            ctx.closePath();
        }
        else
        {
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < n - 1; ++i)
            {
                const m = mid(points[i], points[i + 1]);
                ctx.quadraticCurveTo(points[i].x, points[i].y, m.x, m.y);
            }

            ctx.lineTo(points[n - 1].x, points[n - 1].y);
        }
    }

    /**
     * Strokes the current path with optional dash styling.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {number} width Stroke width.
     * @param {string} color Stroke color.
     * @param {Array<number>} [dash=[]] Dash pattern.
     */
    _stroke(ctx, width, color, dash = [])
    {
        ctx.setLineDash(dash);
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Draws the main track surface with layered strokes.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Track points.
     * @param {Object} colors Theme palette.
     */
    _drawTrack(ctx, points, colors)
    {
        if (!points || points.length < 2) return;

        this._tracePath(ctx, points, true);

        this._stroke(ctx, 10, colors.glow);
        this._stroke(ctx, 7, colors.casing);
        this._stroke(ctx, 5, colors.surface);
        this._stroke(ctx, 1, colors.centerline, [4, 6]);
    }

    /**
     * Draws the pit lane overlay with dashed styling.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} points Pit lane points.
     * @param {Object} colors Theme palette.
     */
    _drawPitLane(ctx, points, colors)
    {
        if (!points || points.length < 2) return;

        this._tracePath(ctx, points, false);
        this._stroke(ctx, 2, colors.pit, [3, 3]);
    }

    /**
     * Builds a rounded rectangle path for number labels.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {number} x Left coordinate.
     * @param {number} y Top coordinate.
     * @param {number} w Width.
     * @param {number} h Height.
     * @param {number} r Corner radius.
     */
    _roundRect(ctx, x, y, w, h, r)
    {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /**
     * Draws a single vehicle marker and its number label.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Object} v Vehicle data.
     * @param {Object} colors Theme palette.
     */
    _drawStar(ctx, cx, cy, outerR, innerR, points)
    {
        ctx.beginPath();

        for (let i = 0; i < points * 2; ++i)
        {
            const r = i % 2 === 0 ? outerR : innerR;
            const angle = (i * Math.PI) / points - Math.PI / 2;

            if (i === 0)
            {
                ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
            }
            else
            {
                ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
            }
        }

        ctx.closePath();
    }

    _drawVehicle(ctx, v, colors)
    {
        let x = v.world_pos.x;
        let y = v.world_pos.y;

        let c = ColorFromVehicleClass(v.vehicle_class);
        let radius = 5.5;
        const isLeader = v.race_position_class === 1;

        if (v.focus)
        {
            c = colors.ring;
            radius += 2;
        }

        if (v.in_pits)
        {
            radius *= 0.65;
            ctx.globalAlpha = 0.45;
        }

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;

        if (isLeader)
        {
            this._drawStar(ctx, x, y, radius + 1, (radius + 1) * 0.45, 5);
            ctx.fillStyle = c;
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        else
        {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = c;
            ctx.fill();
        }

        ctx.restore();

        if (!isLeader)
        {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.lineWidth = 1.25;
            ctx.strokeStyle = colors.ring;
            ctx.stroke();
        }

        if (!v.in_pits)
        {
            ctx.font = 'bold 9px Titillium Web, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const text = String(v.vehicle_number);
            const tw = ctx.measureText(text).width;

            const pw = tw + 8;
            const ph = 13;
            const pxr = x - pw / 2;
            const pyr = y - radius - ph - 4;

            this._roundRect(ctx, pxr, pyr, pw, ph, 4);
            ctx.fillStyle = colors.labelBg;
            ctx.fill();

            ctx.fillStyle = colors.labelText;
            ctx.fillText(text, x, pyr + ph / 2 + 0.5);
        }

        ctx.globalAlpha = 1.0;
    }

    /**
     * Draws all vehicles while ensuring the focused car is rendered last.
     * @param {CanvasRenderingContext2D} ctx Canvas drawing context.
     * @param {Array<Object>} vehicles Vehicles to draw.
     * @param {Object} colors Theme palette.
     */
    _drawVehicles(ctx, vehicles, colors)
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
                this._drawVehicle(ctx, vehicles[idx], colors);
            }
        }

        if (focus)
        {
            this._drawVehicle(ctx, focus, colors);
        }
    }

    /**
     * Returns the index of the track point closest to a world position.
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

        return 0;
    }

    /**
     * Strokes a highlighted arc centered around a given track index with glow.
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

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

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
        ctx.restore();
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
        const colors = this._palette();

        for (const vehicle of this.standings)
        {
            if (vehicle.show_warning_icon && !vehicle.in_pits && vehicle.world_pos)
            {
                this._drawWarningZone(ctx, this.map.track_map, vehicle.world_pos, 4, colors.warning);
            }
        }
    }
}
