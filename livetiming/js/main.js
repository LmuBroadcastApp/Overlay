/**
 * @file Entry point for the livetiming overlay page.
 */

/**
 * Websocket callbacks that translate feed payloads into shared state updates.
 */
const callBacks =
{
    onStandingsUpdate: (data) =>
    {
        stateManager.setState('standings', data);
    },
    onSessionUpdate: (data) =>
    {
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
        stateManager.setState('overlay_settings', data);
    }
};

/**
 * Shared websocket connection for the livetiming page.
 */
const webSocketWrapper = new WebSocketWrapper(`ws://${window.location.hostname}:6433`);
webSocketWrapper.setCallback(callBacks);

/**
 * Registers all panels used by the livetiming page.
 */
panelRegistry.register('session', SessionPanel, '#session-info');
panelRegistry.register('worldmap', WorldMapPanel, '#track-map-panel');
panelRegistry.register('standings', StandingsPanel, '#live-timing-standings');

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

/**
 * Initializes the dark/light theme toggle.
 */
function InitThemeToggle()
{
    const checkbox = document.querySelector('#light-theme');
    if (!checkbox) return;

    const apply = (light) =>
    {
        document.body.classList.toggle('theme-light', light);
    };

    checkbox.checked = window.location.search.includes('light');

    checkbox.addEventListener('change', () => apply(checkbox.checked));
    apply(checkbox.checked);
}

window.addEventListener('beforeunload', () =>
{
    cancelAnimationFrame(animationId);
    webSocketWrapper.disconnect();
    panelRegistry.destroyAll();
});

window.addEventListener('load', () =>
{
    InitThemeToggle();
    panelRegistry.createAll(stateManager);

    // In mock mode (index.html?mock) the data is generated locally, no websocket needed
    if (!window.MOCK_MODE)
    {
        webSocketWrapper.connect();
    }

    animationId = requestAnimationFrame(fnc_main_loop);
});
