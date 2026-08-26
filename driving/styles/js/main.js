function UpdateOverlaySettings(settings)
{
    const root = document.documentElement;
    console.log(settings);

    // pit stop estimation panel
    root.style.setProperty('--telemetry-pit-stop-estimation-left', settings.driving_pitstop.position_left);
    root.style.setProperty('--telemetry-pit-stop-estimation-top', settings.driving_pitstop.position_top);

    // input telemetry panel
    root.style.setProperty('--telemetry-input-chart-left', settings.driving_telemetry.position_left);
    root.style.setProperty('--telemetry-input-chart-top', settings.driving_telemetry.position_top);

    // wather forecast
    root.style.setProperty('--weather-forecast-left', settings.driving_weather.position_left);
    root.style.setProperty('--weather-forecast-top', settings.driving_weather.position_top);
}

function HideIfNotInRealTime()
{
    document.getElementsByTagName("BODY")[0].style.display = "block";
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
    },

    onStandingsUpdate: (data) =>
    {
        stateManager.setState('standings', data);
    }
};

// Create websocket instance
const webSocketWrapper = new WebSocketWrapper(`ws://${window.location.hostname}:6433`);
webSocketWrapper.SetCallback(callBacks);

// Register panels
panelRegistry.register('PitStopEstimation', PitStopEstimation, '#telemetry-pit-stop-estimation');
panelRegistry.register('TelemetryChart', TelemetryChart, '#telemetry-input-chart');
panelRegistry.register('Weather', WeatherPanel, '#weather-panel');

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
    webSocketWrapper.Connect();
});
