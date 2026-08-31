/**
 * @fileoverview Boots the driving overlay, wires websocket events, and manages panel updates.
 */

/**
 * Tracks whether each driving panel is enabled.
 * @type {Object<string, boolean>}
 */
const g_PanelEnabled =
{
    pitstop: true,
    telemetry: true,
    weather: true,
    damage: true,
    trackMap: true,
    laptime: false
};

/**
 * Applies the current panel visibility state.
 */
function ApplyPanelVisibility()
{
    const panels =
    {
        telemetry: document.getElementById('telemetry-input-chart'),
        pitstop: document.getElementById('pit-stop-estimation'),
        trackMap: document.getElementById('track-map-panel'),
        weather: document.getElementById('weather-panel'),
        laptime: document.getElementById('laptime-log'),
        damage: document.getElementById('damage-panel')
    };

    Object.entries(panels).forEach(([key, panel]) =>
    {
        if (!panel) return;
        panel.style.display = g_PanelEnabled[key] ? '' : 'none';
    });
}

/**
 * Applies persisted overlay settings to the driving panel CSS variables.
 * @param {Object} settings Overlay settings payload from the backend.
 */
function UpdateOverlaySettings(settings)
{
    const root = document.documentElement;
    ApplyPanelVisibility();

    // pit stop estimation panel
    root.style.setProperty('--pit-stop-estimation-left', settings.driving_pitstop.position_left);
    root.style.setProperty('--pit-stop-estimation-top', settings.driving_pitstop.position_top);

    // input telemetry panel
    root.style.setProperty('--telemetry-input-chart-left', settings.driving_telemetry.position_left);
    root.style.setProperty('--telemetry-input-chart-top', settings.driving_telemetry.position_top);

    // weather forecast panel
    root.style.setProperty('--weather-forecast-left', settings.driving_weather.position_left);
    root.style.setProperty('--weather-forecast-top', settings.driving_weather.position_top);

    // damage panel
    root.style.setProperty('--damage-left', settings.driving_damage.position_left);
    root.style.setProperty('--damage-top', settings.driving_damage.position_top);

    root.style.setProperty('--laptime-log-left', settings.driving_laptime_log.position_left);
    root.style.setProperty('--laptime-log-top', settings.driving_laptime_log.position_top);

    root.style.setProperty('--track-map-left', settings.driving_track_map.position_left);
    root.style.setProperty('--track-map-top', settings.driving_track_map.position_top);
}

/**
 * Handles draggable panel move notifications.
 * @param {string} panelId Moved panel element ID.
 * @param {number} left Final left position in pixels.
 * @param {number} top Final top position in pixels.
 */
function OnPanelMoved(panelId, left, top)
{
    // Called when the user finishes dragging a panel (left/top in pixels)
    console.log(`Panel ${panelId} moved to left=${left}px, top=${top}px`);
}

/**
 * Shows the overlay only while the player is in real time.
 * @param {boolean} inRealTime Whether the game is currently in real-time mode.
 */
function HideOverlayIfNotInRealTIme(inRealTime)
{
    document.body.style.display = inRealTime ? 'block' : 'none';
}

/**
 * Shared websocket callbacks used to push feed updates into the state manager.
 */
const callBacks =
{
    onStandingsUpdate: (data) =>
    {
        stateManager.setState('standings', data);
    },
    onSessionUpdate: (data) =>
    {
        HideOverlayIfNotInRealTIme(data.inRealTime);
        stateManager.setState('session', data);
    },
    onTrackMapUpdate: (data) =>
    {
        stateManager.setState('map', data);
    },
    onOverlayControlsUpdate: (data) =>
    {
        stateManager.setState('overlay_controls', data);
    },
    onOverlaySettingsUpdate: (data) =>
    {
        UpdateOverlaySettings(data);
        stateManager.setState('overlay_settings', data);
    },
    onPitStopEstimation: (data) =>
    {
        stateManager.setState('pitStopEstimation', data);
    }
};

// Create websocket instance (port can be overridden with ?port=1234 in the URL)
const wsPort = new URLSearchParams(window.location.search).get('port') || '6433';
const webSocketWrapper = new WebSocketWrapper(`ws://${window.location.hostname}:${wsPort}`);
webSocketWrapper.setCallback(callBacks);

// Register panels
panelRegistry.register('PitStopEstimation', PitStopEstimation, '#pit-stop-estimation');
panelRegistry.register('TelemetryChart', TelemetryChart, '#telemetry-input-chart');
panelRegistry.register('WorldMap', WorldMapPanel, '#track-map-panel');
panelRegistry.register('Weather', WeatherPanel, '#weather-panel');
panelRegistry.register('LaptimeLog', LaptimeLog, '#laptime-log');
panelRegistry.register('Damage', DamagePanel, '#damage-panel');

// Make panels draggable
const draggablePanels = new DraggablePanels(OnPanelMoved);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fps = 60;
const frameDuration = 1000 / fps;

let lastTime = 0;
let animationId = null;

/**
 * Main animation loop that updates all registered panels at the configured frame rate.
 * @param {number} timestamp requestAnimationFrame timestamp.
 */
function fnc_main_loop(timestamp)
{
    const deltaTime = timestamp - lastTime;
    if (deltaTime >= frameDuration)
    {
        panelRegistry.updateAll();
        lastTime = timestamp;
    }
    animationId = requestAnimationFrame(fnc_main_loop);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

window.addEventListener('beforeunload', () =>
{
    cancelAnimationFrame(animationId);
    webSocketWrapper.disconnect();
});

window.addEventListener('load', () =>
{
    animationId = requestAnimationFrame(fnc_main_loop);
    panelRegistry.createAll(stateManager);

    draggablePanels.register('#pit-stop-estimation', '--pit-stop-estimation-left', '--pit-stop-estimation-top');
    draggablePanels.register('#telemetry-input-chart', '--telemetry-input-chart-left', '--telemetry-input-chart-top');
    draggablePanels.register('#weather-panel', '--weather-forecast-left', '--weather-forecast-top');
    draggablePanels.register('#damage-panel', '--damage-left', '--damage-top');
    draggablePanels.register('#laptime-log', '--laptime-log-left', '--laptime-log-top');

    if (!window.MOCK_MODE)
    {
        webSocketWrapper.connect();
    }
});
