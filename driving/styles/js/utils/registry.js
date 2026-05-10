class PanelRegistry
{
    constructor()
    {
        this.panels = new Map();
        this.instances = new Map();
    }

    register(name, PanelClass, selector)
    {
        this.panels.set(name, { PanelClass, selector });
    }

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

    createAll(stateManager, ...args)
    {
        this.panels.forEach((panel, name) =>
        {
            const instance = new panel.PanelClass(panel.selector, stateManager, ...args);
            this.instances.set(name, instance);
        });
    }

    get(name)
    {
        return this.instances.get(name);
    }

    updateAll()
    {
        this.instances.forEach(panel =>
        {
            if (typeof panel.update === 'function') {
                panel.update();
            }
        });
    }
}

var panelRegistry = new PanelRegistry();
