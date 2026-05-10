class WebSocketWrapper
{
    constructor(url)
    {
        this.url = url;
        this.ws = null;
        this.callback = null;
    }

    setCallback(callback)
    {
        if (typeof callback.onStandingsUpdate !== 'function')
        {
            console.log('Callback object must implement onStandingsUpdate method');
            return false
        }

        if (typeof callback.onSessionUpdate !== 'function')
        {
            console.log('Callback object must implement onSessionUpdate method');
            return false
        }

        if (typeof callback.onTrackMapUpdate !== 'function')
        {
            console.log('Callback object must implement onTrackMapUpdate method');
            return false
        }

        if (typeof callback.onOverlayUpdate !== 'function')
        {
            console.log('Callback object must implement onOverlayUpdate method');
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

    connect()
    {
        let ws = new WebSocket(this.url);
        let cb = this.callback;

        ws.onopen = function()
        {
            console.log("WebSocket connected to " + ws.url);
        };

        ws.onmessage = function(event)
        {
            let data = null;

            try
            {
                data = JSON.parse(event.data);
            }
            catch (e)
            {
                console.log("Failed to parse WebSocket message: " + e.message);
                return;
            }

            switch (data.type)
            {
                case 'standings':
                {
                    cb.onStandingsUpdate(data.payload);
                } break;
                case 'session':
                {
                    cb.onSessionUpdate(data.payload);
                } break;
                case 'trackmap':
                {
                    cb.onTrackMapUpdate(data.payload);
                } break;
                case 'overlay':
                {
                    cb.onOverlayUpdate(data.payload);
                } break;
                case 'overlay_settings':
                {
                    cb.onOverlaySettingsUpdate(data.payload);
                } break;
                default:
                {
                    console.log("Unknown message type: " + data.type);
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

    disconnect()
    {
        if (this.ws)
        {
            this.ws.close();
            this.ws = null;
        }
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
