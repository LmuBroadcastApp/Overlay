class StateManager
{
    constructor()
    {
        this.state =
        {
            standings: null,
            session: null,
            map: null,
            controls: null
        };

        this.observers = [];
    }

    setState(key, value)
    {
        if (this.state[key] !== value)
        {
            this.state[key] = value;
            this.notifyObservers(key);
        }
    }

    getState(key)
    {
        return this.state[key];
    }

    subscribe(observer)
    {
        this.observers.push(observer);
    }

    unsubscribe(observer)
    {
        this.observers = this.observers.filter(obs => obs !== observer);
    }

    notifyObservers(changedKey)
    {
        this.observers.forEach(observer =>
        {
            if (typeof observer === 'function')
            {
                observer(changedKey, this.state[changedKey]);
            }
        });
    }
}

var stateManager = new StateManager();
