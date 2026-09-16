/**
 * @file Minimal observable state container shared by overlay pages.
 */

/**
 * Stores page state and notifies subscribers when keys change.
 */
class StateManager
{
    /**
     * Creates the state container with the known overlay keys.
     */
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

    /**
     * Updates a state key and notifies observers when the value changed.
     *
     * @param {string} key State key to update.
     * @param {*} value New value for the key.
     */
    setState(key, value)
    {
        if (this.state[key] !== value)
        {
            this.state[key] = value;
            this.notifyObservers(key);
        }
    }

    /**
     * Reads the current value of a state key.
     *
     * @param {string} key State key to read.
     * @returns {*} Stored value for the key.
     */
    getState(key)
    {
        return this.state[key];
    }

    /**
     * Subscribes a function to state change notifications.
     *
     * @param {Function} observer Callback receiving (changedKey, newValue).
     */
    subscribe(observer)
    {
        this.observers.push(observer);
    }

    /**
     * Removes a previously subscribed observer.
     *
     * @param {Function} observer Observer function to remove.
     */
    unsubscribe(observer)
    {
        this.observers = this.observers.filter(obs => obs !== observer);
    }

    /**
     * Notifies all observers about a changed state key.
     *
     * @param {string} changedKey State key that changed.
     */
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
