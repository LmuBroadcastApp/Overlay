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
 * Enables Ctrl-drag positioning for the track map and restores persisted offsets.
 */
function InitDraggablePanels()
{
    const storageKey = 'livetiming-panel-positions';
    const root = document.documentElement;

    let positions = {};
    try { positions = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch (e) { /* corrupted, start fresh */ }

    for (const [varName, value] of Object.entries(positions))
    {
        root.style.setProperty(varName, value);
    }

    const draggable = new DraggablePanels((panelId, position) =>
    {
        Object.assign(positions, position);
        localStorage.setItem(storageKey, JSON.stringify(positions));
    });

    draggable.register('#track-map-panel',
    [
        { varName: '--map-panel-position-left', property: 'margin-left' },
        { varName: '--map-panel-position-top', property: 'margin-top' }
    ]);
}

/**
 * Initializes the dark/light theme toggle and restores the persisted selection.
 */
function InitThemeToggle()
{
    const checkbox = document.querySelector('#light-theme');
    if (!checkbox) return;

    const apply = (light) =>
    {
        document.body.classList.toggle('theme-light', light);
        localStorage.setItem('livetiming-theme', light ? 'light' : 'dark');
    };

    checkbox.checked = localStorage.getItem('livetiming-theme') === 'light'
                    || window.location.search.includes('light');

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
    InitDraggablePanels();
    panelRegistry.createAll(stateManager);

    // In mock mode (index.html?mock) the data is generated locally, no websocket needed
    if (!window.MOCK_MODE)
    {
        webSocketWrapper.connect();
    }

    animationId = requestAnimationFrame(fnc_main_loop);
});
