# LMUBroadcastOverlay

The web overlay pages used by **LMUBroadcastApp** for Le Mans Ultimate.

This project is plain HTML, CSS and JavaScript — there is no build step, no bundler and no framework. The pages are served by the app's built-in HTTP server and receive live race data over the app's WebSocket server. The same pages can be opened in a normal browser for preview or used directly as an OBS browser source.

---

## Pages

| Page | URL | Purpose |
|------|-----|---------|
| **Broadcasting** | `http://localhost:6432/broadcasting/index.html` | Full stream overlay: standings tower, focused driver, telemetry, battle, session, weather, track map, notifications, starting grid and live classification |
| **Driving** | `http://localhost:6432/driving/index.html` | Driver-focused overlay: input telemetry, pit-stop estimation, damage, weather and track map |
| **Livetiming** | `http://localhost:6432/livetiming/index.html` | Full-page live timing for a second screen or browser: session header, complete standings table and track map |

Ports are configurable in the app (`File → Settings → Servers`). The default HTTP port is `6432`; the default WebSocket port is `6433`.

---

## How it works

```text
Le Mans Ultimate
      │  shared memory + game web services
      ▼
LMUBroadcastApp  ── HTTP :6432 ──► these pages
      │
      └──────────── WebSocket :6433 ──► live data
```

`shared/js/websocket.js` connects to the WebSocket server, parses JSON messages and dispatches them to the page's callbacks. `shared/js/state.js` stores the latest payload per feed, and `shared/js/registry.js` creates and updates the registered panels on a fixed animation loop.

### WebSocket messages

| Type | Payload |
|------|---------|
| `standings` | Full standings, vehicles, drivers, sectors, pit stops, telemetry summary |
| `session` | Track, session type and timing, weather, flags, camera/focus info, replay state |
| `trackmap` | Track outline, pit lane, sector markers and map size |
| `pitStopEstimation` | Per-service pit-stop time breakdown |
| `overlay_controls` | Operator switches: focus panel, animation speeds, grid/classification visibility, tower options |
| `overlay_settings` | Persisted panel enable flags, positions, colours, typography and scales |

The broadcasting and livetiming pages connect to `ws://<host>:6433`. The driving page accepts an optional `?port=` query parameter.

---

## Broadcasting page

| Panel | What it shows |
|-------|---------------|
| **Tower** | Standings with class splits, gaps (leader or ahead), sectors, position gain/loss, optional pit stops, energy/fuel, tires, best/last lap and damage. Can hide DNF entries. |
| **Battle** | Nearby cars around the focused vehicle while a battle is active |
| **Driver** | Focused driver card with position, name/team, number, class, last/best lap |
| **Telemetry** | Speed and RPM gauges, gear, throttle/brake bars, last/best lap, intervals, delta, energy, sector times and mini-sectors, tire age |
| **Session** | Track and session name, remaining time, in-game time, per-sector yellow flags |
| **Weather** | Current conditions plus short-term forecast: track/air temperature, rain chance, grip, wind |
| **Track map** | Circuit outline, pit lane, car markers, yellow warning zones for off-track or abnormally slow cars |
| **Notifications** | Race winner, fastest lap, penalties, track limits, incidents and possible best lap |
| **Starting grid** | Fullscreen staggered grid from the qualifying order, paged by time or rows, with car images, class and lap time |
| **Live classification** | Fullscreen field grouped by vehicle class with position, laps, gap and position change |
| **Replay banner** | Shown while the game is in replay; the rest of the overlay is hidden |

**Exclusive overlays** — the starting grid and live classification take over the whole window while active. Classification has priority when both are enabled. Every other panel is hidden until they are turned off.

Panel visibility, positions, colours, fonts, tower columns and animation speeds are pushed live from the app via `overlay_settings` and `overlay_controls`.

---

## Driving page

| Panel | What it shows |
|-------|---------------|
| **Input telemetry** | Throttle, brake, steering, speed and gear trace for the player car |
| **Pit-stop estimation** | Estimated time for driver swap, penalties, damage, tires, fuel and virtual energy, plus the total |
| **Damage** | Aero, body, suspension and brake damage with severity colouring |
| **Weather** | Forecast plus grip, rain, temperature and wind |
| **Track map** | Circuit outline with the player's position and warning zones |

The whole page is hidden while the game is not running in real time (for example during replays). Each panel has its own enable toggle, position and scale, controlled from the app's `Driving style` settings.

> `laptime_log` is present in the markup and script folder but is currently not registered in `driving/js/main.js`, so it is inactive.

---

## Livetiming page

- Session header: track, per-sector flags, session name, remaining time, in-game time, forecast and current weather
- Complete standings table with position, class, vehicle, driver/team, status, laps, sectors, last/best lap, intervals, gaps, pits, tires, damage, track cuts and fuel/energy
- Track map
- On-page toggles: show/hide track map, split by vehicle class, light theme
- `?light` in the URL starts the page in light mode

This page is intended for a second monitor or for sharing the live timing with viewers.

---

## Project structure

```text
LMUBroadcasOverlay/
├── broadcasting/          # Stream overlay
│   ├── index.html
│   ├── css/               # One stylesheet per panel + common
│   └── js/
│       ├── main.js        # WebSocket wiring, visibility rules, panel registration
│       ├── notifications/ # Notification controller and display
│       ├── panels/        # tower, battle, driver, telemetry, session, weather, map,
│       │                  # starting_grid, classification
│       └── utils/         # standings, sectors, virtual DOM, mock data
├── driving/               # Driver-focused overlay
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── main.js
│       ├── panels/        # telemetry, pit_stop_estimation, damage, weather, map, laptime_log
│       └── utils/         # standings, draggable, mock data
├── livetiming/            # Full-page live timing
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── main.js
│       ├── panels/        # session, standings, trackmap
│       └── utils/         # standings, colours, mock data
└── shared/
    ├── fonts/             # Titillium, Roboto, FiraCode Nerd Font
    ├── img/               # Manufacturer logos, weather icons, replay banner
    ├── js/                # websocket, state, registry, draggable
    └── libs/              # jQuery, Chart.js
```

---

## Running and previewing

**Through the app (normal use)**
1. Start LMUBroadcastApp and load a game session.
2. Open `Panels → Custom overlays`.
3. Use **Open In Browser** to preview the selected overlay, or **Open Livetiming** for the timing page.
4. For OBS, use a **Browser** source with one of the URLs above.
5. To use this folder instead of the overlay packed inside the app, set `File → Settings → Servers → Assets directory` to this directory. Clearing the field returns to the built-in copy.

**Standalone preview**
Serve the folder with any static HTTP server (opening `index.html` directly also works for layout-only preview). Live data still requires LMUBroadcastApp's WebSocket server on port `6433`.

**Mock mode**
The broadcasting and livetiming pages can generate local data without the app. Append `?mock` to the page URL:

```text
http://localhost:6432/broadcasting/index.html?mock
http://localhost:6432/livetiming/index.html?mock
```

**Moving panels**
Hold **Ctrl** and drag a panel to reposition it. The new position is currently only logged to the console — it is not persisted back to the app yet; use the app's overlay settings for permanent positions.

---

## Customizing and extending

- **Styling** — panel positions, colours, widths and fonts are CSS custom properties set by `UpdateOverlaySettings()` in each page's `main.js`. Change the defaults in CSS, or change the values sent by the app.
- **Adding a panel**
  1. Add the markup and stylesheet to the page.
  2. Create a class with a constructor `(selector, stateManager)`, subscribe to state changes, and implement `update()`.
  3. Register it with `panelRegistry.register('name', ClassName, '#selector')` and optionally `createAll`.
  4. Add visibility handling in `ApplyPanelVisibility()`.
- **New data feeds** — add the message type to `WebSocketWrapper.MESSAGE_HANDLERS` in `shared/js/websocket.js`, then handle it in the page's `callBacks`.
- **Shared helpers** — `StandingsGetFocus`, standings sorting and sector helpers live in the per-page `utils/standings.js` files; the virtual DOM helper avoids rebuilding tables every frame.

The starting grid loads per-car and manufacturer images from the game's own web service at `http://<game host>:6397`. If those images do not resolve, the grid still renders with the text information.

---

## Notes and limitations

- The pages depend on the app for live data; opening a page without it shows an empty overlay (or mock data with `?mock`).
- The app sends `overlay_settings` and `overlay_controls`; an older app version may omit newer fields. The pages fall back to safe defaults where possible.
- No package manager or build step is required. jQuery and Chart.js are vendored in `shared/libs`.
- The overlay is designed for a 16:9 game window; panels use fixed/rem positions so they stay aligned when the game window is moved or resized.
