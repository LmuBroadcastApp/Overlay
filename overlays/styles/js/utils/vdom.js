/**
 * VirtualDOM — A lightweight virtual DOM implementation for building
 * and efficiently updating DOM trees without full innerHTML rebuilds.
 * Supports keyed reconciliation for efficient list reordering.
 */
class VirtualDOM
{
    /**
     * Initializes the VirtualDOM instance and creates the internal VNode constructor.
     */
    constructor()
    {
        this._VNode = this._createVNodeClass();
    }

    /**
     * Hyperscript function to create a virtual node representing a DOM element or text.
     * Automatically flattens nested arrays and converts primitives to text nodes.
     *
     * @param {string} tag - The HTML tag name (e.g., 'div'), or '#text' for text nodes.
     * @param {Object|null} attrs - An object containing HTML attributes, event handlers, styles, and keys.
     * @param {...(Array|Object|string|number|null|boolean)} children - Variadic child nodes. Can be nested arrays.
     * @returns {Object} The created Virtual Node (VNode).
     */
    h(tag, attrs, ...children)
    {
        const flatChildren = this._flatten(children);
        const key = (attrs && attrs.key) || null;

        if (attrs && attrs.htmlContent != null && flatChildren.length > 0)
        {
            console.warn('VirtualDOM: "htmlContent" and children are mutually exclusive; children will be ignored.', tag);
            return new this._VNode(tag, attrs, [], key);
        }

        return new this._VNode(tag, attrs || {}, flatChildren, key);
    }

    /**
     * Renders a VNode tree into a real DOM container (initial mount).
     * Wipes the container's existing content before mounting.
     *
     * @param {Object} vnode - The root VNode to render.
     * @param {Element} container - The real DOM element to render into.
     * @returns {Object} The rendered VNode, now populated with a reference to its real DOM element (.el).
     */
    render(vnode, container)
    {
        container.innerHTML = '';
        container.appendChild(this._createElement(vnode));
        return vnode;
    }

    /**
     * Patches a real DOM tree by comparing a previous and new VNode tree.
     * Only modifies the specific DOM nodes that have changed.
     *
     * @param {Object} prev - The previous (currently rendered) VNode tree.
     * @param {Object} next - The new VNode tree representing the desired state.
     * @param {Element} parent - The real DOM parent element of the root node.
     * @returns {Object} The patched VNode tree (returns the `next` tree with .el populated).
     */
    patch(prev, next, parent)
    {
        // Text Node Patching
        if (prev.tag === '#text' && next.tag === '#text')
        {
            if (prev.value !== next.value)
            {
                prev.el.nodeValue = next.value;
                // Removed: prev.value = next.value; (Don't mutate old tree)
            }
            next.el = prev.el;
            return next;
        }

        // Tag changed -> Full replacement
        if (prev.tag !== next.tag)
        {
            parent.replaceChild(this._createElement(next), prev.el);
            return next;
        }

        // Tag is the same -> Reuse element, diff props and children
        let el = prev.el;
        next.el = el;
        this._diffProps(el, prev.attrs, next.attrs);
        this._patchChildren(el, prev.children, next.children);
        return next;
    }

    /**
     * Creates the lightweight VNode constructor used internally.
     *
     * @returns {Function} The VNode constructor function.
     */
    _createVNodeClass()
    {
        return function VNode(tag, attrs, children, key)
        {
            this.tag = tag;
            this.attrs = attrs || {};
            this.children = children || [];
            this.key = key;
            this.el = null;
            this.value = null; // Explicitly define value
        };
    }

    /**
     * Flattens a nested array of children into a flat array of VNodes.
     * Converts strings/numbers to text VNodes. Filters out null, undefined, and booleans.
     *
     * @param {Array} arr - The potentially nested array of children.
     * @returns {Array<Object>} A flat array containing only VNodes.
     */
    _flatten(arr)
    {
        let result = [];
        for (let i = 0; i < arr.length; i++)
        {
            let v = arr[i];
            if (v == null || v === false || v === true)
            {
                continue;
            }

            if (Array.isArray(v))
            {
                result = result.concat(this._flatten(v));
            }
            else if (typeof v === 'string' || typeof v === 'number')
            {
                // Cleaner text node creation
                let node = new this._VNode('#text', {}, [], null);
                node.value = String(v);
                result.push(node);
            } else
            {
                result.push(v);
            }
        }
        return result;
    }

    /**
     * Recursively converts a VNode and its children into real DOM Nodes.
     *
     * @param {Object} v - The VNode to convert.
     * @returns {Node} The created real DOM Node.
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

        for (let k in v.attrs)
        {
            this._setProp(el, k, v.attrs[k]);
        }

        for (let i = 0; i < v.children.length; i++)
        {
            el.appendChild(this._createElement(v.children[i]));
        }

        return el;
    }

    /**
     * Applies a single attribute/property to a real DOM element.
     * Handles special cases like className, style objects, innerHTML, and event listeners.
     *
     * @param {Element} el - The target DOM element.
     * @param {string} name - The attribute/property name.
     * @param {*} val - The value to assign.
     */
    _setProp(el, name, val)
    {
        if (name === 'key')
        {
            return;
        }

        if (name === 'className' || name === 'class')
        {
            el.className = val || '';
            return;
        }

        if (name === 'style' && typeof val === 'object')
        {
            // Clear old inline styles before applying new ones if updating
            el.style.cssText = '';
            for (let k in val)
            {
                el.style[k] = val[k];
            }
            return;
        }

        if (name === 'htmlContent')
        {
            el.innerHTML = val;
            return;
        }

        if (name === 'value' || name === 'checked' || name === 'disabled' || name === 'selected')
        {
            // Set as a property so live form state is updated
            el[name] = val;
            return;
        }

        if (name.slice(0, 2) === 'on')
        {
            const evt = name.slice(2).toLowerCase();

            // Remove old listener to prevent memory leaks and duplicate fires
            if (!el._vdomListeners)
            {
                el._vdomListeners = {};
            }

            if (el._vdomListeners[evt])
            {
                el.removeEventListener(evt, el._vdomListeners[evt]);
            }

            el.addEventListener(evt, val);
            el._vdomListeners[evt] = val; // Store reference for removal
            return;
        }

        if (val == null || val === false)
        {
            el.removeAttribute(name);
            return;
        }

        el.setAttribute(name, val === true ? '' : val);
    }

    /**
     * Shallowly compares two style objects for equality.
     *
     * @param {Object} a - The first style object.
     * @param {Object} b - The second style object.
     * @returns {boolean} True if both objects contain the same keys and values.
     */
    _styleEquals(a, b)
    {
        if (a === b)
        {
            return true;
        }

        if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object')
        {
            return false;
        }

        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        if (aKeys.length !== bKeys.length)
        {
            return false;
        }

        for (let k of aKeys)
        {
            if (a[k] !== b[k])
            {
                return false;
            }
        }

        return true;
    }

    /**
     * Diffs the old and new attributes objects, applying additions, changes, and removals
     * directly to the DOM element.
     *
     * @param {Element} el - The real DOM element to update.
     * @param {Object} old - The previous attributes object.
     * @param {Object} now - The new attributes object.
     */
    _diffProps(el, old, now)
    {
        // 1. Remove old properties
        for (let k in old)
        {
            if (k === 'key')
            {
                continue;
            }

            if (!(k in now))
            {
                if (k === 'className' || k === 'class')
                {
                    el.className = '';
                }
                else if (k === 'style')
                {
                    el.style.cssText = '';
                }
                else if (k === 'htmlContent')
                {
                    el.innerHTML = ''; // Fix: Clear htmlContent
                }
                else if (k.slice(0, 2) === 'on')
                {
                    // Fix: Actually remove event listeners
                    const evt = k.slice(2).toLowerCase();
                    if (el._vdomListeners && el._vdomListeners[evt])
                    {
                        el.removeEventListener(evt, el._vdomListeners[evt]);
                        delete el._vdomListeners[evt];
                    }
                }
                else
                {
                    el.removeAttribute(k);
                }
            }
        }

        // 2. Set new/updated properties
        for (let k in now)
        {
            // Deep-compare style objects so fresh-but-identical literals don't reset inline styles
            if (k === 'style' && this._styleEquals(old[k], now[k]))
            {
                continue;
            }

            if (now[k] !== old[k]) this._setProp(el, k, now[k]);
        }
    }

    /**
     * Reconciles an element's children by determining whether to use
     * index-based patching or keyed reconciliation.
     *
     * @param {Element} parent - The real DOM parent element.
     * @param {Array<Object>} oldKids - The previous array of child VNodes.
     * @param {Array<Object>} newKids - The new array of child VNodes.
     */
    _patchChildren(parent, oldKids, newKids)
    {
        let useKeys = false;
        for (let i = 0; i < newKids.length; i++)
        {
            if (newKids[i].key != null)
            {
                useKeys = true;
                break;
            }
        }

        if (useKeys) this._patchKeyed(parent, oldKids, newKids);
        else this._patchSimple(parent, oldKids, newKids);
    }

    /**
     * Fast, index-based child patching. Assumes child order is stable.
     * Patches up to the length of the shortest array, then appends/removes as needed.
     *
     * @param {Element} parent - The real DOM parent element.
     * @param {Array<Object>} oldKids - The previous array of child VNodes.
     * @param {Array<Object>} newKids - The new array of child VNodes.
     */
    _patchSimple(parent, oldKids, newKids)
    {
        let n = Math.min(oldKids.length, newKids.length);
        for (let i = 0; i < n; i++)
        {
            newKids[i] = this.patch(oldKids[i], newKids[i], parent);
        }

        if (newKids.length > oldKids.length)
        {
            for (let i = oldKids.length; i < newKids.length; i++)
            {
                parent.appendChild(this._createElement(newKids[i]));
            }
        }
        else if (oldKids.length > newKids.length)
        {
            for (let i = newKids.length; i < oldKids.length; i++)
            {
                parent.removeChild(oldKids[i].el);
            }
        }
    }

    /**
     * Keyed child reconciliation algorithm. Efficiently reorders, adds, and removes
     * children by matching their `key` attribute using a single-pass reference tracker.
     *
     * @param {Element} parent - The real DOM parent element.
     * @param {Array<Object>} oldKids - The previous array of child VNodes.
     * @param {Array<Object>} newKids - The new array of child VNodes.
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
            {
                parent.insertBefore(target, ref);
            }

            ref = target ? target.nextSibling : null;
        }

        // Cleanup: Remove old nodes that weren't placed
        for (let i = 0; i < oldKids.length; i++)
        {
            let c = oldKids[i];
            if (c.key != null && !placed[c.key]) parent.removeChild(c.el); else if (c.key == null) parent.removeChild(c.el);
        }
    }
}
