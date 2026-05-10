class WebSocketWrapper
{
    constructor(url)
    {
        this.url = url;
        this.ws = null;
        this.callback = null;
    }

    SetCallback(callback)
    {
        if (typeof callback.onPitStopEstimation !== 'function')
        {
            console.log('Callback object must implement onStandingsUpdate method');
            return false
        }

        if (typeof callback.onStandingsUpdate !== 'function')
        {
            console.log('Callback object must implement onStandingsUpdate method');
            return false
        }

        if (typeof callback.onOverlaySettingsUpdate !== 'function')
        {
            console.log('Callback object must implement onOverlaySettingsUpdate method');
            return false
        }

        this.callback = callback;
        return true;
    }

    Connect()
    {
        let ws = new WebSocket(this.url);
        let cb = this.callback;

        ws.onopen = function()
        {
            console.log("WebSocket connected to " + ws.url);
        };

        ws.onmessage = function(event)
        {
            var data = JSON.parse(event.data);
            switch (data.type)
            {
                case 'standings':
                {
                    cb.onStandingsUpdate(data.payload);
                } break;

                case 'pitStopEstimation':
                {
                    cb.onPitStopEstimation(data.payload);
                } break;
                case 'overlay_settings':
                {
                    cb.onOverlaySettingsUpdate(data.payload);
                } break;
            }
        };

        ws.onclose = function()
        {
            console.log("WebSocket disconnected from " + ws.url);
        };

        ws.onerror = function(error)
        {
            console.log("WebSocket error: " + error.message);
        };

        this.ws = ws;
    }
}

function isEmpty(obj)
{
    for (const prop in obj)
    {
        if (Object.hasOwn(obj, prop))
        {
            return false;
        }
    }

    return true;
}

function isEmptyObject(value)
{
    if (value == null)
    {
        // null or undefined
        return false;
    }

    if (typeof value !== 'object')
    {
        // boolean, number, string, function, etc.
        return false;
    }

    const proto = Object.getPrototypeOf(value);

    // consider `Object.create(null)`, commonly used as a safe map
    // before `Map` support, an empty object as well as `{}`
    if (proto !== null && proto !== Object.prototype)
    {
        return false;
    }

    return isEmpty(value);
}
