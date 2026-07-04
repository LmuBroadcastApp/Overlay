/**
 * VirtualDOM — A lightweight virtual DOM implementation for building
 * and efficiently updating DOM trees without full innerHTML rebuilds.
 *
 * Usage:
 *
 *   const vdom = new VirtualDOM();
 *
 *   // 1. Create a VNode tree with h()
 *   let tree = vdom.h('div', { className: 'standings' },
 *       vdom.h('table', { id: 'race-table' },
 *           vdom.h('thead', null,
 *               vdom.h('tr', null,
 *                   vdom.h('th', null, 'Pos'),
 *                   vdom.h('th', null, 'Driver')
 *               )
 *           ),
 *           vdom.h('tbody', null,
 *               vdom.h('tr', { key: 1, className: 'row-1' },
 *                   vdom.h('td', null, '1'),
 *                   vdom.h('td', null, 'Hamilton')
 *               ),
 *               vdom.h('tr', { key: 2, className: 'row-2' },
 *                   vdom.h('td', null, '2'),
 *                   vdom.h('td', null, 'Verstappen')
 *               )
 *           )
 *       )
 *   );
 *
 *   // 2. Render into a container
 *   vdom.render(tree, document.getElementById('panel'));
 *
 *   // 3. Create an updated tree and patch only the differences
 *   let newTree = vdom.h('div', { className: 'standings' },
 *       vdom.h('table', { id: 'race-table' },
 *           vdom.h('thead', null,
 *               vdom.h('tr', null,
 *                   vdom.h('th', null, 'Pos'),
 *                   vdom.h('th', null, 'Driver')
 *               )
 *           ),
 *           vdom.h('tbody', null,
 *               vdom.h('tr', { key: 1, className: 'row-1' },
 *                   vdom.h('td', null, '1'),
 *                   vdom.h('td', null, 'Hamilton')
 *               ),
 *               vdom.h('tr', { key: 3, className: 'row-3' },
 *                   vdom.h('td', null, '3'),
 *                   vdom.h('td', null, 'Norris')
 *               )
 *           )
 *       )
 *   );
 *   vdom.patch(tree, newTree, document.getElementById('panel'));
 *
 * Supported attributes:
 *   className, class, style (object), htmlContent (innerHTML),
 *   on* (event listeners), key (reconciliation key), and any
 *   other attribute set via setAttribute.
 */

class VirtualDOM
{
    constructor()
    {
        this._VNode = this._createVNodeClass();
    }

    /**
     * Create a virtual node representing a DOM element or text.
     * @param {string} tag  - Element tag name, or '#text' for text nodes
     * @param {Object} attrs - Attributes/properties (className, style, etc.)
     * @param {Array|string|number|null} children - Child VNodes, strings, or numbers
     * @returns {Object} A VNode with { tag, attrs, children, key, el }
     */
    h(tag, attrs)
    {
        let rest = [];
        for (let i = 2; i < arguments.length; i++) rest.push(arguments[i]);
        let children = this._flatten(rest);
        let key = (attrs && attrs.key) || null;
        return new (this._VNode)(tag, attrs || {}, children, key);
    }

    /**
     * Render a VNode tree into a DOM container (initial render).
     * Wipes the container and builds the full DOM.
     * @param {Object} vnode - The root VNode to render
     * @param {Element} container - The DOM container element
     * @returns {Object} The rendered VNode (with .el set)
     */
    render(vnode, container)
    {
        container.innerHTML = '';
        container.appendChild(this._createElement(vnode));
        return vnode;
    }

    /**
     * Patch a DOM tree by comparing a previous and new VNode tree.
     * Only modified nodes are touched in the real DOM.
     * @param {Object} prev - The previous (current) VNode tree
     * @param {Object} next - The new VNode tree to reconcile to
     * @param {Element} parent - DOM parent element for the root
     * @returns {Object} The patched VNode tree (next, with .el populated)
     */
    patch(prev, next, parent)
    {
        if (prev.tag === '#text' && next.tag === '#text')
        {
            if (prev.value !== next.value)
            {
                prev.el.nodeValue = next.value;
                prev.value = next.value;
            }
            next.el = prev.el;
            return next;
        }

        if (prev.tag !== next.tag)
        {
            parent.replaceChild(this._createElement(next), prev.el);
            return next;
        }

        let el = prev.el;
        next.el = el;
        this._diffProps(el, prev.attrs, next.attrs);
        this._patchChildren(el, prev.children, next.children);
        return next;
    }

    /**
     * Creates the lightweight VNode constructor used internally.
     * @private
     * @returns {Function} VNode constructor
     */
    _createVNodeClass()
    {
        /** @private */
        return function VNode(tag, attrs, children, key)
        {
            this.tag = tag;
            this.attrs = attrs || {};
            this.children = children || [];
            this.key = key;
            this.el = null;
            if (tag === '#text') this.value = attrs;
        };
    }

    /**
     * Flatten a nested array of children into a flat array of VNodes,
     * converting strings/numbers to text VNodes and filtering null/true/false.
     * @private
     * @param {Array} arr - Nested children array
     * @returns {Array} Flat VNode array
     */
    _flatten(arr)
    {
        let result = [];
        for (let i = 0; i < arr.length; i++)
        {
            let v = arr[i];
            if (v == null || v === false || v === true) continue;
            if (Array.isArray(v))
            {
                result = result.concat(this._flatten(v));
            }
            else if (typeof v === 'string' || typeof v === 'number')
            {
                let VNode = this._VNode;
                result.push(new VNode('#text', String(v), [], null));
            }
            else
            {
                result.push(v);
            }
        }
        return result;
    }

    /**
     * Convert a VNode into a real DOM element (recursive).
     * @private
     * @param {Object} v - The VNode
     * @returns {Node} The created DOM node
     */
    _createElement(v)
    {
        if (v.tag === '#text')
        {
            v.el = document.createTextNode(v.value);
            return v.el;
        }

        let el = document.createElement(v.tag);
        v.el = el;

        for (let k in v.attrs) this._setProp(el, k, v.attrs[k]);
        for (let i = 0; i < v.children.length; i++)
            el.appendChild(this._createElement(v.children[i]));

        return el;
    }

    /**
     * Set a single attribute/property on a DOM element.
     * @private
     * @param {Element} el - The DOM element
     * @param {string} name - Attribute name
     * @param {*} val - Attribute value
     */
    _setProp(el, name, val)
    {
        if (name === 'key') return;
        if (name === 'className' || name === 'class')
        {
            el.className = val || '';
            return;
        }
        if (name === 'style' && typeof val === 'object')
        {
            for (let k in val) el.style[k] = val[k];
            return;
        }
        if (name === 'htmlContent')
        {
            el.innerHTML = val;
            return;
        }
        if (name.slice(0, 2) === 'on')
        {
            el.addEventListener(name.slice(2).toLowerCase(), val);
            return;
        }
        el.setAttribute(name, val);
    }

    /**
     * Diff old and new attributes and apply changes to the element.
     * @private
     * @param {Element} el - The real DOM element
     * @param {Object} old - Previous attrs map
     * @param {Object} now - New attrs map
     */
    _diffProps(el, old, now)
    {
        for (let k in old)
        {
            if (k === 'key') continue;
            if (!(k in now))
            {
                if (k === 'className' || k === 'class') el.className = '';
                else if (k === 'style' && typeof old[k] === 'object') el.style.cssText = '';
                else if (k.slice(0, 2) !== 'on' && k !== 'htmlContent') el.removeAttribute(k);
            }
        }
        for (let k in now)
        {
            if (now[k] !== old[k]) this._setProp(el, k, now[k]);
        }
    }

    /**
     * Reconcile child VNodes by dispatching to keyed or simple patching.
     * @private
     * @param {Element} parent - The parent DOM element
     * @param {Array} oldKids - Previous child VNode array
     * @param {Array} newKids - New child VNode array
     */
    _patchChildren(parent, oldKids, newKids)
    {
        let useKeys = false;
        for (let i = 0; i < newKids.length; i++)
        {
            if (newKids[i].key != null) { useKeys = true; break; }
        }
        if (useKeys)
            this._patchKeyed(parent, oldKids, newKids);
        else
            this._patchSimple(parent, oldKids, newKids);
    }

    /**
     * Index-based child patching (fast, assumes stable order).
     * @private
     */
    _patchSimple(parent, oldKids, newKids)
    {
        let n = Math.min(oldKids.length, newKids.length);
        for (let i = 0; i < n; i++)
            newKids[i] = this.patch(oldKids[i], newKids[i], parent);

        if (newKids.length > oldKids.length)
        {
            for (let i = oldKids.length; i < newKids.length; i++)
                parent.appendChild(this._createElement(newKids[i]));
        }
        else if (oldKids.length > newKids.length)
        {
            for (let i = newKids.length; i < oldKids.length; i++)
                parent.removeChild(oldKids[i].el);
        }
    }

    /**
     * Keyed child reconciliation — efficiently reorders, adds, and removes
     * children by matching their `key` attribute.
     * @private
     */
    _patchKeyed(parent, oldKids, newKids)
    {
        let byKey = {};
        for (let i = 0; i < oldKids.length; i++)
        {
            let c = oldKids[i];
            if (c.key != null) byKey[c.key] = c;
        }

        let placed = {};
        let ref = parent.firstChild;

        for (let i = 0; i < newKids.length; i++)
        {
            let nk = newKids[i];
            let target;

            if (nk.key != null && byKey[nk.key] != null)
            {
                let ok = byKey[nk.key];
                placed[nk.key] = true;
                newKids[i] = this.patch(ok, nk, parent);
                target = newKids[i].el;
            }
            else
            {
                target = this._createElement(nk);
                parent.insertBefore(target, ref);
                ref = target.nextSibling;
                continue;
            }

            if (target !== ref)
                parent.insertBefore(target, ref);

            ref = target ? target.nextSibling : null;
        }

        for (let i = 0; i < oldKids.length; i++)
        {
            let c = oldKids[i];
            if (c.key != null && !placed[c.key]) parent.removeChild(c.el);
            else if (c.key == null) parent.removeChild(c.el);
        }
    }
}
