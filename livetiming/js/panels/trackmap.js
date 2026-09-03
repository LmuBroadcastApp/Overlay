/**
 * @file Stylized world-position track map panel for the livetiming page.
 */

/**
 * Draws the circuit, pit lane, vehicles, and warning markers on a canvas map.
 */
class WorldMapPanel
{
    /**
     * Creates the world-position track map panel.
     *
     * @param {string} selector Canvas selector for the panel.
     * @param {StateManager} stateManager Shared page state manager.
     */
    constructor(selector, stateManager)
    {
        this.canvas = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.canvas)
        {
            console.error(`WorldMapPanel: Element ${selector} not found`);
            return;
        }

        this.stateManager.subscribe(this.handleStateChange.bind(this));
        this.standings = this.stateManager.getState('standings');
        this.map = this.stateManager.getState('map');
        this.session = this.stateManager.getState('session');
        this.splineOffset = null;

        this.visible = true;
        this.checkbox = document.querySelector('#show-track-map');

        if (this.checkbox)
        {
            this.checkboxHandler = () => this.applyVisibility(this.checkbox.checked);
            this.checkbox.addEventListener('change', this.checkboxHandler);
            this.applyVisibility(this.checkbox.checked);
        }

        this.scale = 1;
        this.scaleInput = document.querySelector('#track-map-scale');
        this.scaleValue = document.querySelector('#track-map-scale-value');

        if (this.scaleInput)
        {
            this.scaleHandler = () =>
            {
                this.scale = this.scaleInput.valueAsNumber / 100;
                if (this.scaleValue)
                {
                    this.scaleValue.textContent = this.scaleInput.value + '%';
                }
            };
            this.scaleHandler();
            this.scaleInput.addEventListener('input', this.scaleHandler);
        }
    }

    /**
     * Shows or hides the map canvas.
     *
     * @param {boolean} visible Whether the map should be visible.
     */
    applyVisibility(visible)
    {
        this.visible = visible;
        this.canvas.style.display = visible ? '' : 'none';
    }

    /**
     * Reacts to relevant state changes.
     *
     * @param {string} key Changed state key.
     * @param {*} value New state value.
     */
    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.standings = value;
        }
        else if (key === 'session')
        {
            this.session = value;
        }
        else if (key === 'map')
        {
            this.map = value;
            this.splineOffset = null; // track changed, offset must be recomputed
        }
    }

    /**
     * Builds a theme-aware palette for canvas drawing.
     *
     * @returns {Object} Canvas color palette.
     */
    _palette()
    {
        const light = document.body.classList.contains('theme-light');

        return light
            ? {
                glow:       'rgba(23, 25, 34, 0.10)',
                casing:     '#9aa0ad',
                surface:    '#ccd0d9',
                centerline: 'rgba(255, 255, 255, 0.9)',
                pit:        'rgba(115, 122, 140, 0.8)',
                labelBg:    'rgba(23, 25, 34, 0.78)',
                labelText:  '#ffffff',
                ring:       '#ffffff',
                start:      '#e10600'
            }
            : {
                glow:       'rgba(240, 241, 245, 0.08)',
                casing:     '#05050a',
                surface:    '#3a3d47',
                centerline: 'rgba(240, 241, 245, 0.35)',
                pit:        'rgba(124, 128, 144, 0.8)',
                labelBg:    'rgba(0, 0, 0, 0.65)',
                labelText:  '#f0f1f5',
                ring:       '#f0f1f5',
                start:      '#ff4d4d'
            };
    }

    /**
     * Re-renders the full track map.
     */
    update()
    {
        if (!this.visible) return;

        const canvas = this.canvas;
        const ctx = canvas.getContext("2d");

        if (this.map == null || this.map.track_map.length === 0 || this.standings == null)
        {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        // Crisp rendering on high-DPI displays; scale scales the whole map uniformly
        const dpr = window.devicePixelRatio || 1;
        const scale = this.scale || 1;
        const w = this.map.size.width;
        const h = this.map.size.height;
        const sw = w * scale;
        const sh = h * scale;

        if (canvas.width !== sw * dpr || canvas.height !== sh * dpr)
        {
            canvas.width = sw * dpr;
            canvas.height = sh * dpr;
            canvas.style.width = sw + 'px';
            canvas.style.height = sh + 'px';
        }

        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        const colors = this._palette();

        this._drawPitLane(ctx, this.map.pit_lane, colors);
        this._drawTrack(ctx, this.map.track_map, colors);

        //this._drawYellowSectors(ctx);
        //this._drawClassLegend(ctx, colors);
        //this._drawStartLine(ctx, this.map.track_map, colors);

        this._drawWarningZones(ctx);
        this._drawVehicles(ctx, Array.from(this.standings).reverse(), colors);
    }

    /**
     * Traces a smooth path through the given points.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
     * @param {Array<Object>} points Path points.
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
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
     * @param {number} width Stroke width.
     * @param {string} color Stroke color.
     * @param {Array<number>} dash Dash pattern.
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
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
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
     * Draws the pit lane overlay.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
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
     * Draws the start/finish line indicator.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
     * @param {Array<Object>} points Track points.
     * @param {Object} colors Theme palette.
     */
    _drawStartLine(ctx, points, colors)
    {
        if (!points || points.length < 2) return;

        const a = points[0];
        const b = points[1];

        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const px = (b.y - a.y) / len;
        const py = -(b.x - a.x) / len;
        const half = 6;

        ctx.beginPath();
        ctx.moveTo(a.x + px * half, a.y + py * half);
        ctx.lineTo(a.x - px * half, a.y - py * half);
        this._stroke(ctx, 3, colors.start);
    }

    /**
     * Builds a rounded rectangle path for number labels.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
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
     * Draws one vehicle marker on the map.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
     * @param {Object} v Vehicle standings row.
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
        const x = v.world_pos.x;
        const y = v.world_pos.y;

        let c = ColorFromVehicleClass(v.vehicle_class);
        let radius = 5.5;
        const isLeader = v.race_position_class === 1;

        if (v.in_pits)
        {
            radius *= 0.65;
            ctx.globalAlpha = 0.45;
        }

        // Soft drop shadow under the marker
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;

        if (isLeader)
        {
            this._drawStar(ctx, x, y, radius + 1, (radius + 1) * 0.45, 5);
            ctx.fillStyle = c;
            ctx.fill();
        }
        else
        {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.fillStyle = c;
            ctx.fill();
        }

        ctx.restore();

        if (isLeader)
        {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        else
        {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
            ctx.lineWidth = 1.25;
            ctx.strokeStyle = colors.ring;
            ctx.stroke();
        }

        if (!v.in_pits)
        {
            // Number pill above the marker
            ctx.font = 'bold 9px Roboto, sans-serif';
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
     * Draws all vehicles, rendering the focused one last so it stays visible.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
     * @param {Array<Object>} vehicles Vehicle rows to draw.
     * @param {Object} colors Theme palette.
     */
    _drawVehicles(ctx, vehicles, colors)
    {
        vehicles.sort((a, b) => (b.in_pits - a.in_pits));

        for (let idx in vehicles)
        {
            this._drawVehicle(ctx, vehicles[idx], colors);
        }
    }

    /**
     * Draws a compact class legend in the map corner.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
     * @param {Object} colors Theme palette.
     */
    _drawClassLegend(ctx, colors)
    {
        if (!this.standings || this.standings.length === 0)
        {
            return;
        }

        const classes = [];
        for (const v of this.standings)
        {
            if (!classes.includes(v.vehicle_class))
            {
                classes.push(v.vehicle_class);
            }
        }

        if (classes.length === 0)
        {
            return;
        }

        const pad = 7;
        const rowH = 15;
        const boxW = 96;
        const boxH = pad * 2 + rowH * classes.length;
        const x = 0;
        const y = this.map.size.height - boxH;

        this._roundRect(ctx, x, y, boxW, boxH, 6);
        ctx.fillStyle = colors.labelBg;
        ctx.fill();

        ctx.font = 'bold 9px Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        classes.forEach((cls, i) =>
        {
            const cy = y + pad + rowH * i + rowH / 2;
            const cx = x + 12;

            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, 2 * Math.PI, false);
            ctx.fillStyle = ColorFromVehicleClass(cls);
            ctx.fill();

            ctx.fillStyle = colors.labelText;
            ctx.fillText(cls, cx + 8, cy);
        });
    }

    /** Sector boundaries as spline fractions; from map sector distances when available, otherwise thirds. */
    _sectorFractions()
    {
        const sectors = this.map.sectors;
        const trackDistance = this.session ? this.session.trackDistance : 0;

        if (sectors && trackDistance > 0)
        {
            return [sectors.sector1 / trackDistance, sectors.sector2 / trackDistance, sectors.sector3 / trackDistance, 1];
        }

        return [0, 1 / 3, 2 / 3, 1];
    }

    /** Highlights yellow flagged sectors directly on the track outline. */
    _drawYellowSectors(ctx)
    {
        if (!this.session || !this.session.sectorFlags) return;

        const points = this.map.track_map;
        const n = points.length;
        const offset = this._getSplineOffset(points);
        const fractions = this._sectorFractions();

        for (let s = 0; s < 3; ++s)
        {
            if (!this.session.sectorFlags[s]) continue;

            const start = Math.round(offset + fractions[s] * n) % n;
            const count = Math.max(1, Math.round((fractions[s + 1] - fractions[s]) * n));

            ctx.save();
            ctx.shadowColor = 'rgba(255, 209, 102, 0.9)';
            ctx.shadowBlur = 7;

            ctx.beginPath();
            ctx.moveTo(points[start].x, points[start].y);

            for (let i = 1; i <= count; ++i)
            {
                const p = points[(start + i) % n];
                ctx.lineTo(p.x, p.y);
            }

            ctx.strokeStyle = 'rgba(255, 209, 102, 0.75)';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.restore();
        }
    }

    /**
     * @brief Index of the track point closest to a world position.
     * Needed because spline 0 does not coincide with index 0 of the track map array.
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
     * @brief Spline -> track map index offset, computed once per track and cached.
     * spline 0 does not coincide with index 0 of the track map array; the offset is
     * derived from a vehicle on track: offset = nearestIndex(world_pos) - spline * n.
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

    /** Variant A: zone centered on the track point nearest to the vehicle world position. */
    _drawWarningZone(ctx, points, worldPos, size, color)
    {
        const half = Math.max(1, Math.round(0.02 * points.length));
        const center = this._nearestTrackPointIndex(points, worldPos);

        this._strokeZone(ctx, points, center, half, size, color);
    }

    /** Variant B: zone located by spline using the cached spline -> index offset. */
    _drawWarningZoneBySpline(ctx, points, spline, size, color)
    {
        const n = points.length;
        const half = Math.max(1, Math.round(0.02 * n));
        const center = Math.round(this._getSplineOffset(points) + spline * n) % n;

        this._strokeZone(ctx, points, center, half, size, color);
    }

    /**
     * Draws glowing warning markers around flagged cars on the track.
     *
     * @param {CanvasRenderingContext2D} ctx Canvas context.
     */
    _drawWarningZones(ctx)
    {
        for (const vehicle of this.standings)
        {
            if (vehicle.show_warning_icon && !vehicle.in_pits && vehicle.world_pos)
            {
                this._drawWarningZone(ctx, this.map.track_map, vehicle.world_pos, 4, "rgb(249, 199, 79)");
                // Alternative: this._drawWarningZoneBySpline(ctx, this.map.track_map, vehicle.spline, 4, "rgb(249, 199, 79)");
            }
        }
    }

    /**
     * Cleans up DOM listeners created by the panel.
     */
    destroy()
    {
        if (this.checkbox && this.checkboxHandler)
        {
            this.checkbox.removeEventListener('change', this.checkboxHandler);
        }

        if (this.scaleInput && this.scaleHandler)
        {
            this.scaleInput.removeEventListener('input', this.scaleHandler);
        }
    }
}
