// Shared WebSocket wrapper used by all pages.
// Dispatches incoming messages to the callback object by message type;
// a page only needs to implement handlers for the messages it cares about.

class WebSocketWrapper
{
    static MESSAGE_HANDLERS =
    {
        'standings'         : 'onStandingsUpdate',
        'session'           : 'onSessionUpdate',
        'pitStopEstimation' : 'onPitStopEstimation',
        'trackmap'          : 'onTrackMapUpdate',
        'overlay_controls'  : 'onOverlayControlsUpdate',
        'overlay_settings'  : 'onOverlaySettingsUpdate',
    };

    constructor(url)
    {
        this.url = url;
        this.ws = null;
        this.callback = null;

        this.reconnectDelayMs = 3000;
        this.shouldReconnect = true;
        this.reconnectTimer = null;
    }

    setCallback(callback)
    {
        this.callback = callback;
        return true;
    }

    connect()
    {
        let ws = new WebSocket(this.url);
        let cb = this.callback;
        let self = this;

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

            const handlerName = WebSocketWrapper.MESSAGE_HANDLERS[data.type];

            if (handlerName === undefined)
            {
                console.log("Unknown message type: " + data.type);
                return;
            }

            if (cb && typeof cb[handlerName] === 'function')
            {
                cb[handlerName](data.payload);
            }
        };

        ws.onclose = function()
        {
            console.log("WebSocket disconnected from " + ws.url);

            // Try to reconnect so the page recovers when the server restarts
            if (self.shouldReconnect && self.reconnectTimer === null)
            {
                self.reconnectTimer = setTimeout(() =>
                {
                    self.reconnectTimer = null;
                    self.connect();
                }, self.reconnectDelayMs);
            }
        };

        ws.onerror = function(error)
        {
            console.log("WebSocket error: " + error.message);
        };

        this.ws = ws;
    }

    disconnect()
    {
        this.shouldReconnect = false;

        if (this.reconnectTimer !== null)
        {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws)
        {
            this.ws.close();
            this.ws = null;
        }
    }
}
