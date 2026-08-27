function UpdateOverlaySettings(settings)
{
    const root = document.documentElement;

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

    // lap time log panel (optional in older backends)
    if (settings.driving_laptime_log)
    {
        root.style.setProperty('--laptime-log-left', settings.driving_laptime_log.position_left);
        root.style.setProperty('--laptime-log-top', settings.driving_laptime_log.position_top);
    }
}

function OnPanelMoved(panelId, left, top)
{
    // Called when the user finishes dragging a panel (left/top in pixels)
    console.log(`Panel ${panelId} moved to left=${left}px, top=${top}px`);
}

function HideOrShowOverlay(inRealTime)
{
    document.body.style.display = inRealTime ? 'block' : 'none';
}

const callBacks =
{
    onOverlaySettingsUpdate: (data) =>
    {
        UpdateOverlaySettings(data);
    },

    onPitStopEstimation: (data) =>
    {
        stateManager.setState('onPitStopEstimation', data);
    },

    onSessionUpdate: (data) =>
    {
        stateManager.setState('session', data);
        HideOrShowOverlay(data.inRealTime);
    },

    onStandingsUpdate: (data) =>
    {
        stateManager.setState('standings', data);
    }
};

// Create websocket instance (port can be overridden with ?port=1234 in the URL)
const wsPort = new URLSearchParams(window.location.search).get('port') || '6433';
const webSocketWrapper = new WebSocketWrapper(`ws://${window.location.hostname}:${wsPort}`);
webSocketWrapper.setCallback(callBacks);

// Register panels
panelRegistry.register('PitStopEstimation', PitStopEstimation, '#pit-stop-estimation');
panelRegistry.register('TelemetryChart', TelemetryChart, '#telemetry-input-chart');
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
