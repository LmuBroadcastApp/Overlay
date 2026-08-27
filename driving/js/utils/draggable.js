/**
 * Makes overlay panels draggable with the mouse while Ctrl is held.
 *
 * Each panel is positioned through a pair of CSS variables (left/top).
 * While dragging, those variables are updated in pixels; when the mouse
 * is released, the onMoved callback is invoked with the final position:
 *
 *     onMoved(panelId, left, top)   // left/top in pixels (numbers)
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

    register(selector, varLeft, varTop)
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

            const rect = element.getBoundingClientRect();

            this.active =
            {
                element: element,
                varLeft: varLeft,
                varTop: varTop,

                /** Cursor offset inside the panel, so it doesn't jump */
                offsetX: e.clientX - rect.left,
                offsetY: e.clientY - rect.top,

                left: rect.left,
                top: rect.top
            };

            element.setPointerCapture(e.pointerId);
            element.style.cursor = 'grabbing';

            e.preventDefault();
        });

        element.addEventListener('pointermove', (e) =>
        {
            if (this.active === null)
            {
                return;
            }

            this.active.left = e.clientX - this.active.offsetX;
            this.active.top = e.clientY - this.active.offsetY;

            this.root.style.setProperty(this.active.varLeft, `${this.active.left}px`);
            this.root.style.setProperty(this.active.varTop, `${this.active.top}px`);
        });

        element.addEventListener('pointerup', (e) =>
        {
            if (this.active === null)
            {
                return;
            }

            const { element: el, left, top } = this.active;

            el.releasePointerCapture(e.pointerId);
            el.style.cursor = e.ctrlKey ? 'grab' : '';

            this.active = null;

            if (typeof this.onMoved === 'function')
            {
                this.onMoved(el.id, Math.round(left), Math.round(top));
            }
        });
    }
}
