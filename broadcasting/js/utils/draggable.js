/**
 * Makes overlay panels draggable with the mouse while Ctrl is held.
 *
 * Each panel is positioned through a pair of CSS variables, but the anchor
 * differs per panel (margin-left/top, right, bottom...). Every registered
 * axis therefore specifies which CSS property the variable feeds, so the
 * drag can resolve the starting value in pixels and apply the delta with
 * the correct sign (left/top grow to the right/down, right/bottom shrink).
 *
 * When the mouse is released, the onMoved callback is invoked as:
 *
 *     onMoved(panelId, position)
 *
 * where position maps each CSS variable to its final pixel value, e.g.
 * { "--standings-panel-position-left": "24px", "--standings-panel-position-top": "80px" }
 */
class DraggablePanels
{
    constructor(onMoved)
    {
        this.onMoved = onMoved;
        this.root = document.documentElement;

        this.active = null;
        this.elements = [];

        // Show the grab cursor only while Ctrl is held
        window.addEventListener('keydown', (e) =>
        {
            if (e.key === 'Control')
            {
                this._setCursor('grab');
            }
        });

        window.addEventListener('keyup', (e) =>
        {
            if (e.key === 'Control' && this.active === null)
            {
                this._setCursor('');
            }
        });
    }

    _setCursor(cursor)
    {
        this.elements.forEach(el => el.style.cursor = cursor);
    }

    /**
     * @param {string} selector - CSS selector of the panel element.
     * @param {Array} axes - One entry per moving axis:
     *   {
     *     varName:  CSS variable that positions the panel (e.g. '--map-panel-position-right'),
     *     property: CSS property the variable feeds (e.g. 'right', 'margin-left'),
     *     invert:   true when the property grows opposite to the pointer (right/bottom)
     *   }
     */
    register(selector, axes)
    {
        const element = document.querySelector(selector);

        if (!element)
        {
            console.error(`DraggablePanels: Element ${selector} not found`);
            return;
        }

        this.elements.push(element);

        element.addEventListener('pointerdown', (e) =>
        {
            // Only draggable while Ctrl is pressed
            if (!e.ctrlKey)
            {
                return;
            }

            const style = getComputedStyle(element);

            this.active =
            {
                element: element,
                startX: e.clientX,
                startY: e.clientY,

                axes: axes.map(axis => (
                {
                    ...axis,
                    startValue: parseFloat(style.getPropertyValue(axis.property)) || 0,
                    value: parseFloat(style.getPropertyValue(axis.property)) || 0,
                    horizontal: axis.property.includes('left') || axis.property.includes('right')
                }))
            };

            try { element.setPointerCapture(e.pointerId); } catch (err) { /* no active pointer (synthetic event) */ }
            element.style.cursor = 'grabbing';

            e.preventDefault();
        });

        element.addEventListener('pointermove', (e) =>
        {
            if (this.active === null || this.active.element !== element)
            {
                return;
            }

            const dx = e.clientX - this.active.startX;
            const dy = e.clientY - this.active.startY;

            for (const axis of this.active.axes)
            {
                const delta = axis.horizontal ? dx : dy;
                axis.value = axis.startValue + (axis.invert ? -delta : delta);

                this.root.style.setProperty(axis.varName, `${Math.round(axis.value)}px`);
            }
        });

        element.addEventListener('pointerup', (e) =>
        {
            if (this.active === null || this.active.element !== element)
            {
                return;
            }

            const position = {};

            for (const axis of this.active.axes)
            {
                position[axis.varName] = `${Math.round(axis.value)}px`;
            }

            try { element.releasePointerCapture(e.pointerId); } catch (err) { /* capture was never acquired */ }
            element.style.cursor = e.ctrlKey ? 'grab' : '';

            this.active = null;

            if (typeof this.onMoved === 'function')
            {
                this.onMoved(element.id, position);
            }
        });
    }
}
