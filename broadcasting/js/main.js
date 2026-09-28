/**
 * @file Entry point for the broadcasting overlay page.
 */

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
    notifications: true,
    grid: true
};

/**
 * Shows or hides the matched elements, animated with the speed the operator set on the overlay.
 * Defined once at load time rather than rebuilt on every visibility pass.
 */
$.fn.showIf = function(condition)
{
    let speed = stateManager.getState('overlay_controls')?.overlay_animation_speed;
    speed = isNaN(speed) ? 0 : speed * 1000;

    return condition ? this.show(speed) : this.hide(speed);
};

/** @brief Like showIf, but keeps the flex layout of the notification stack intact. */
$.fn.visibleIf = function(condition)
{
    return condition ? this.css('visibility', 'visible') : this.css('visibility', 'hidden');
};

/**
 * Publishes which overlay currently owns the whole window, if any.
 *
 * Panels that manage their own visibility subscribe to the 'overlay_exclusive' state key so
 * they can step aside for the fullscreen overlays.
 *
 * @param {?(string)} name Exclusive overlay name ('replay' or 'grid'), or null when none is active.
 */
function SetExclusiveOverlay(name)
{
    stateManager.setState('overlay_exclusive', name);
}

/**
 * Applies the current enabled/disabled panel visibility state, also honoring the fullscreen overlays.
 *
 * The starting grid is exclusive: while it is active it takes the whole window and every other
 * overlay is hidden. Replay keeps its own dedicated banner instead.
 */
function ApplyPanelVisibility()
{
    let grid = stateManager.getState('overlay_controls')?.show_starting_grid === true
        && g_PanelEnabled.grid
        && !g_ReplayActive;
    let show = !g_ReplayActive && !grid;

    $("#tower-panel").showIf(show && g_PanelEnabled.standings);
    $("#battle-panel").showIf(show && g_PanelEnabled.relative);
    $("#session-panel").showIf(show && g_PanelEnabled.session);
    $("#weather-panel").showIf(show && g_PanelEnabled.weather);
    $("#track-map-panel").showIf(show && g_PanelEnabled.map);
    $("#telemetry-panel").showIf(show && g_PanelEnabled.telemetry);
    $("#driver-panel").showIf(show && g_PanelEnabled.driver);

    $("#notification-container").visibleIf(show && g_PanelEnabled.notifications);
    $("#gradient-background").showIf(!grid);
    $("#replay-banner").showIf(g_ReplayActive && g_PanelEnabled.replay);
    $("#starting-grid-panel").showIf(grid);

    SetExclusiveOverlay(g_ReplayActive ? 'replay' : (grid ? 'grid' : null));
}

/**
 * Keeps the overlay visibility in sync with replay state changes.
 *
 * @param {StateManager} stateManager Shared page state manager.
 */
function ToggleOverlayByReplay(stateManager)
{
    let active = stateManager.getState("session")?.replayActive;
    active = active === undefined ? false : active;

    if (g_ReplayActive == active) return;
    g_ReplayActive = active;

    ApplyPanelVisibility();
}

/**
 * Applies a starting grid setting to a CSS variable, leaving the stylesheet default in place
 * when the backend does not send the value, so an older settings payload cannot blank the
 * grid layout by writing an invalid length.
 *
 * @param {CSSStyleDeclaration} root Document root element style.
 * @param {string} name CSS custom property name.
 * @param {*} value Value received from the backend, or undefined when it is absent.
 */
function SetGridStyleVariable(root, name, value)
{
    if (value === undefined || value === null || value === "") return;

    root.style.setProperty(name, value);
}

/**
 * Applies the starting grid pager timing the operator set in the overlay controls: the number of
 * seconds each page stays up. A duration of zero turns the pager off and leaves the grid on page
 * one.
 *
 * @param {CSSStyleDeclaration} root Document root element style.
 * @param {Object} controls Overlay controls payload.
 */
function SetGridPagerTiming(root, controls)
{
    let duration = controls?.grid_page_duration_sec;

    if (Number.isFinite(duration)) root.style.setProperty('--starting-grid-page-duration', `${duration}s`);
}

/**
 * Applies overlay settings from the backend to CSS variables and panel enable flags.
 *
 * @param {Object} settings Overlay settings payload.
 */
function UpdateOverlaySettings(settings)
{
    const root = document.documentElement;

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

    root.style.setProperty('--standings-panel-gain-position-color', settings.standings.gain_position_color);
    root.style.setProperty('--standings-panel-lost-position-color', settings.standings.lost_position_color);

    root.style.setProperty('--standings-panel-sector-inactive-color', settings.standings.sector_inactive_color);
    root.style.setProperty('--standings-panel-sector-1-color', settings.standings.sector_1_color);
    root.style.setProperty('--standings-panel-sector-2-color', settings.standings.sector_2_color);
    root.style.setProperty('--standings-panel-sector-3-color', settings.standings.sector_3_color);

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
    root.style.setProperty('--battle-panel-font-weight', settings.relative.font_weight);
    root.style.setProperty('--battle-panel-font-size', settings.relative.font_size);
    root.style.setProperty('--battle-panel-width', settings.relative.panel_width);

    // notifications
    g_PanelEnabled.notifications = settings.notifications?.enabled !== false;
    root.style.setProperty('--notification-panel-position-left', settings.notifications.position_left);
    root.style.setProperty('--notification-panel-position-top', settings.notifications.position_top);
    root.style.setProperty('--notification-panel-font-size', settings.notifications.font_size);
    root.style.setProperty('--notification-panel-width', settings.notifications.panel_width);

    // telemetry
    g_PanelEnabled.telemetry = settings.telemetry?.enabled !== false;
    root.style.setProperty('--telemetry-gauge-size', settings.telemetry.gauge_size);

    // starting grid
    g_PanelEnabled.grid = settings.grid?.enabled !== false;
    SetGridStyleVariable(root, '--starting-grid-font-size', settings.grid?.font_size);
    SetGridStyleVariable(root, '--starting-grid-entry-width', settings.grid?.entry_width);
    SetGridStyleVariable(root, '--starting-grid-entry-height', settings.grid?.entry_height);
    SetGridStyleVariable(root, '--starting-grid-number-width', settings.grid?.number_width);
    SetGridStyleVariable(root, '--starting-grid-row-gap', settings.grid?.row_gap);
    SetGridStyleVariable(root, '--starting-grid-column-gap', settings.grid?.column_gap);
    SetGridStyleVariable(root, '--starting-grid-logo-height', settings.grid?.logo_height);
    SetGridStyleVariable(root, '--starting-grid-stagger', settings.grid?.stagger);
    SetGridStyleVariable(root, '--starting-grid-card-color', settings.grid?.card_color);
    SetGridStyleVariable(root, '--starting-grid-accent-color', settings.grid?.accent_color);
    SetGridStyleVariable(root, '--starting-grid-secondary-color', settings.grid?.secondary_color);
    SetGridStyleVariable(root, '--starting-grid-text-color', settings.grid?.text_color);

    ApplyPanelVisibility();
}

/**
 * Websocket callbacks that translate live feed payloads into shared state updates.
 */
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
    onOverlayControlsUpdate: (data) =>
    {
        stateManager.setState('overlay_controls', data);
        SetGridPagerTiming(document.documentElement, data);
        ApplyPanelVisibility();
    },
    onOverlaySettingsUpdate: (data) =>
    {
        UpdateOverlaySettings(data);
        stateManager.setState('overlay_settings', data);
    }
};

/**
 * Shared websocket connection for the broadcasting overlay.
 */
const webSocketWrapper = new WebSocketWrapper(`ws://${window.location.hostname}:6433`);
webSocketWrapper.setCallback(callBacks);

/**
 * Registers all panels used by the broadcasting overlay.
 */
panelRegistry.register('tower', TowerPanel, '#tower-panel');
panelRegistry.register('battle', BattlePanel, '#battle-panel');
panelRegistry.register('driver', DriverPanel, '#driver-panel');
panelRegistry.register('map', TrackMapPanel, '#track-map-panel');
panelRegistry.register('session', SessionPanel, '#session-panel');
panelRegistry.register('weather', WeatherPanel, '#weather-panel');
panelRegistry.register('telemetry', TelemetryPanel, '#telemetry-panel');
panelRegistry.register('grid', StartingGridPanel, '#starting-grid-panel');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fps = 24;
const frameDuration = 1000 / fps;

let lastTime = 0;
let animationId = null;

/**
 * Main animation loop that updates all registered panels at a fixed maximum rate.
 *
 * @param {DOMHighResTimeStamp} timestamp requestAnimationFrame timestamp.
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
    panelRegistry.destroyAll();
});

/**
 * Called when the user finishes dragging a panel.
 *
 * @param {string} panelId DOM id of the moved panel.
 * @param {Object<string, string>} position CSS variable -> pixel value map.
 */
function OnPanelMoved(panelId, position)
{
    console.log('Panel moved:', panelId, position);
    // TODO: persist the new position (e.g. send to the overlay settings backend)
}

/**
 * Registers all draggable overlay panels using Ctrl + drag behavior.
 */
function RegisterDraggablePanels()
{
    const draggable = new DraggablePanels(OnPanelMoved);

    draggable.register('#tower-panel',
    [
        { varName: '--standings-panel-position-left', property: 'margin-left' },
        { varName: '--standings-panel-position-top', property: 'margin-top' }
    ]);

    draggable.register('#session-panel',
    [
        { varName: '--session-panel-position-left', property: 'margin-left' },
        { varName: '--session-panel-position-top', property: 'margin-top' }
    ]);

    draggable.register('#weather-panel',
    [
        { varName: '--weather-panel-position-right', property: 'right', invert: true },
        { varName: '--weather-panel-position-top', property: 'top' }
    ]);

    draggable.register('#track-map-panel',
    [
        { varName: '--map-panel-position-right', property: 'right', invert: true },
        { varName: '--map-panel-position-top', property: 'top' }
    ]);

    draggable.register('#driver-panel',
    [
        { varName: '--driver-panel-position-right', property: 'right', invert: true },
        { varName: '--driver-panel-position-bottom', property: 'bottom', invert: true }
    ]);

    draggable.register('#battle-panel',
    [
        { varName: '--battle-panel-position-left', property: 'left' },
        { varName: '--battle-panel-position-bottom', property: 'bottom', invert: true }
    ]);

    draggable.register('#notification-container',
    [
        { varName: '--notification-panel-position-left', property: 'left' },
        { varName: '--notification-panel-position-top', property: 'top' }
    ]);

    draggable.register('#replay-banner',
    [
        { varName: '--replay-banner-position-left', property: 'margin-left' },
        { varName: '--replay-banner-position-top', property: 'margin-top' }
    ]);
}

window.addEventListener('load', () =>
{
    let notifier = new NotificationSystem('notification-container');
    panelRegistry.register('notifier', NotificationController, '<!-- ignore -->');

    panelRegistry.createAll(stateManager, notifier);
    RegisterDraggablePanels();

    // Apply the visibility once up front so panels do not stay on screen until the
    // first settings or controls push arrives.
    ApplyPanelVisibility();

    // In mock mode (index.html?mock) the data is generated locally, no websocket needed
    if (!window.MOCK_MODE)
    {
        webSocketWrapper.connect();
    }

    animationId = requestAnimationFrame(fnc_main_loop);
});
