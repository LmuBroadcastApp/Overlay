/**
 * @file Shared WebSocket wrapper used by overlay pages.
 */

/**
 * Dispatches websocket messages to named callback handlers based on message type.
 */
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

    /**
     * Creates the wrapper for one websocket endpoint.
     *
     * @param {string} url Websocket URL to connect to.
     */
    constructor(url)
    {
        this.url = url;
        this.ws = null;
        this.callback = null;

        this.reconnectDelayMs = 3000;
        this.shouldReconnect = true;
        this.reconnectTimer = null;
    }

    /**
     * Registers the callback object that receives typed websocket payloads.
     *
     * @param {Object} callback Object implementing the message handlers it needs.
     * @returns {boolean} Always true.
     */
    setCallback(callback)
    {
        this.callback = callback;
        return true;
    }

    /**
     * Opens the websocket connection and wires reconnection behavior.
     */
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

    /**
     * Closes the websocket and disables automatic reconnects.
     */
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
