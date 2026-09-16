/**
 * @file Registers overlay panel classes and manages their created instances.
 */

/**
 * Registry for panel constructors and live panel instances.
 */
class PanelRegistry
{
    /**
     * Creates an empty registry of panel definitions and instances.
     */
    constructor()
    {
        this.panels = new Map();
        this.instances = new Map();
    }

    /**
     * Returns an already created panel instance by name.
     *
     * @param {string} name Registered panel name.
     * @returns {*} Panel instance or undefined when not created.
     */
    get(name)
    {
        return this.instances.get(name);
    }

    /**
     * Registers a panel class with its DOM selector.
     *
     * @param {string} name Logical panel name.
     * @param {Function} PanelClass Panel constructor.
     * @param {string} selector DOM selector used to locate the panel root.
     */
    register(name, PanelClass, selector)
    {
        this.panels.set(name, { PanelClass, selector });
    }

    /**
     * Creates a single registered panel instance.
     *
     * @param {string} name Registered panel name.
     * @param {StateManager} stateManager Shared page state manager.
     * @param {...*} args Extra constructor arguments forwarded to the panel.
     * @returns {*} Newly created panel instance.
     */
    create(name, stateManager, ...args)
    {
        if (!this.panels.has(name))
        {
            throw new Error(`Panel ${name} not registered`);
        }

        const { PanelClass, selector } = this.panels.get(name);
        const instance = new PanelClass(selector, stateManager, ...args);
        this.instances.set(name, instance);

        return instance;
    }

    /**
     * Creates all registered panels.
     *
     * @param {StateManager} stateManager Shared page state manager.
     * @param {...*} args Extra constructor arguments forwarded to each panel.
     */
    createAll(stateManager, ...args)
    {
        this.panels.forEach((panel, name) =>
        {
            const instance = new panel.PanelClass(panel.selector, stateManager, ...args);
            this.instances.set(name, instance);
        });
    }

    /**
     * Calls destroy() on every panel that implements it, then clears instances.
     */
    destroyAll()
    {
        this.instances.forEach(panel =>
        {
            if (typeof panel.destroy === 'function')
            {
                panel.destroy();
            }
        });

        this.instances.clear();
    }

    /**
     * Calls update() on every created panel that implements it.
     */
    updateAll()
    {
        this.instances.forEach(panel =>
        {
            if (typeof panel.update === 'function')
            {
                panel.update();
            }
        });
    }
}

var panelRegistry = new PanelRegistry();
