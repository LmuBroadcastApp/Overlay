/** @brief Usee to disable panels when replay is active. */
let g_ReplayActive = false;

/** @brief Used to enable/disable panels. */
let g_PanelEnabled =
{
    standings: true,
    session: true,
    driver: true,
    weather: true,
    map: true,
    replay: true,
    relative: true,
    telemetry: true,
    notifications: true
};

function ApplyPanelVisibility(replayActive)
{
    let speed = stateManager.getState("controls")?.overlay_animation_speed;
    speed = isNaN(speed) ? 0 : speed * 1000;

    let show = !replayActive;
    $.fn.showIf = function(condition) { return condition ? this.show(speed) : this.hide(speed); };

    $("#tower-panel").showIf(show && g_PanelEnabled.standings);
    $("#battle-panel").showIf(show && g_PanelEnabled.relative);
    $("#session-panel").showIf(show && g_PanelEnabled.session);
    $("#weather-panel").showIf(show && g_PanelEnabled.weather);
    $("#track-map-panel").showIf(show && g_PanelEnabled.map);
    $("#telemetry-panel").showIf(show && g_PanelEnabled.telemetry);
    $("#driver-panel").showIf(show && g_PanelEnabled.driver);
    $("#replay-banner").showIf(!show && g_PanelEnabled.replay);
}

function ToggleOverlayByReplay(stateManager)
{
    let active = stateManager.getState("session")?.replayActive;
    active = active === undefined ? false : active;

    if (g_ReplayActive == active) return;
    g_ReplayActive = active;

    ApplyPanelVisibility(active);
}

function UpdateOverlaySettings(settings)
{
    const root = document.documentElement;
    console.log(settings);

    // standings panel
    g_PanelEnabled.standings = settings.standings?.enabled !== false;
    root.style.setProperty('--standings-panel-position-left', settings.standings.position_left);
    root.style.setProperty('--standings-panel-position-top', settings.standings.position_top);

    root.style.setProperty('--standings-panel-font-weight', settings.standings.font_weight);
    root.style.setProperty('--standings-panel-font-size', settings.standings.font_size);

    root.style.setProperty('--standings-panel-primary-color', settings.standings.primary_color);
    root.style.setProperty('--standings-panel-secondary-color', settings.standings.secondary_color);

    root.style.setProperty('--standings-panel-gap-less-1-color', settings.standings.gap_less_1_color);
    root.style.setProperty('--standings-panel-gap-less-2-color', settings.standings.gap_less_2_color);

    root.style.setProperty('--standings-panel-col-01-width', settings.standings.col_01_width);
    root.style.setProperty('--standings-panel-col-02-width', settings.standings.col_02_width);
    root.style.setProperty('--standings-panel-col-03-width', settings.standings.col_03_width);
    root.style.setProperty('--standings-panel-col-04-width', settings.standings.col_04_width);
    root.style.setProperty('--standings-panel-col-05-width', settings.standings.col_05_width);
    root.style.setProperty('--standings-panel-col-06-width', settings.standings.col_06_width);
    root.style.setProperty('--standings-panel-col-07-width', settings.standings.col_07_width);

    // session panel
    g_PanelEnabled.session = settings.session?.enabled !== false;
    root.style.setProperty('--session-panel-position-top', settings.session.position_top);
    root.style.setProperty('--session-panel-font-size', settings.session.font_size);

    // driver panel
    g_PanelEnabled.driver = settings.driver?.enabled !== false;
    root.style.setProperty('--driver-panel-position-bottom', settings.driver.position_bottom);
    root.style.setProperty('--driver-panel-position-right', settings.driver.position_right);

    root.style.setProperty('--driver-panel-background-color', settings.driver.background_color);
    root.style.setProperty('--driver-panel-font-size', settings.driver.font_size);
    root.style.setProperty('--driver-panel-width', settings.driver.width);

    // weather panel
    g_PanelEnabled.weather = settings.weather?.enabled !== false;
    root.style.setProperty('--weather-panel-position-right', settings.weather.position_right);
    root.style.setProperty('--weather-panel-position-top', settings.weather.position_top);

    root.style.setProperty('--weather-panel-img-width', settings.weather.image_width);
    root.style.setProperty('--weather-panel-font-size', settings.weather.font_size);

    root.style.setProperty('--weather-panel-header-background-color', settings.weather.header_background_color);
    root.style.setProperty('--weather-panel-body-background-color', settings.weather.body_background_color);
    root.style.setProperty('--weather-panel-text-color', settings.weather.text_color);

    // map panel
    g_PanelEnabled.map = settings.map?.enabled !== false;
    root.style.setProperty('--map-panel-position-right', settings.map.position_right);
    root.style.setProperty('--map-panel-position-top', settings.map.position_top);

    // replay banner
    g_PanelEnabled.replay = settings.replay?.enabled !== false;
    root.style.setProperty('--replay-banner-position-left', settings.replay.position_left);
    root.style.setProperty('--replay-banner-position-top', settings.replay.position_top);

    // battle panel
    g_PanelEnabled.relative = settings.relative?.enabled !== false;
    root.style.setProperty('--battle-panel-position-bottom', settings.relative.position_bottom);
    root.style.setProperty('--battle-panel-position-left', settings.relative.position_left);

    // notifications
    g_PanelEnabled.notifications = settings.notifications?.enabled !== false;
    root.style.setProperty('--notification-panel-position-left', settings.notifications.position_left);
    root.style.setProperty('--notification-panel-position-top', settings.notifications.position_top);
    root.style.setProperty('--notification-panel-font-size', settings.notifications.font_size);
    root.style.setProperty('--notification-panel-width', settings.notifications.panel_width);

    // telemetry
    g_PanelEnabled.telemetry = settings.telemetry?.enabled !== false;
    root.style.setProperty('--telemetry-gauge-size', settings.telemetry.gauge_size);

    ApplyPanelVisibility(g_ReplayActive);
}

const callBacks =
{
    onStandingsUpdate: (data) =>
    {
        stateManager.setState('standings', data);
    },
    onSessionUpdate: (data) =>
    {
        const session = data.trackName !== "" ? data : null;
        stateManager.setState('session', session);
        ToggleOverlayByReplay(stateManager);
    },
    onTrackMapUpdate: (data) =>
    {
        stateManager.setState('map', data);
    },
    onOverlayUpdate: (data) =>
    {
        stateManager.setState('controls', data);
    },
    onOverlaySettingsUpdate: (data) =>
    {
        UpdateOverlaySettings(data);
        stateManager.setState('overlay', data);
    }
};

// Create websocket instance
const webSocketWrapper = new WebSocketWrapper(`ws://${window.location.hostname}:6433`);
webSocketWrapper.setCallback(callBacks);

// Register panels
panelRegistry.register('tower', TowerPanel, '#tower-panel');
panelRegistry.register('battle', BattlePanel, '#battle-panel');
panelRegistry.register('driver', DriverPanel, '#driver-panel');
panelRegistry.register('map', TrackMapPanel, '#track-map-panel');
panelRegistry.register('session', SessionPanel, '#session-panel');
panelRegistry.register('weather', WeatherPanel, '#weather-panel');
panelRegistry.register('telemetry', TelemetryPanel, '#telemetry-panel');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fps = 24;
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

window.addEventListener('beforeunload', () =>
{
    panelRegistry.destroyAll();
});

window.addEventListener('load', () =>
{
    let notifier = new NotificationSystem('notification-container');
    panelRegistry.register('notifier', NotificationController, '<!-- ignore -->');

    panelRegistry.createAll(stateManager, notifier);
    webSocketWrapper.connect();

    animationId = requestAnimationFrame(fnc_main_loop);
});
