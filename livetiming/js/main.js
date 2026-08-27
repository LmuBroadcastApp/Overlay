window.addEventListener('resize', (event) => {
    let canvas = document.getElementById("live-timing-map");
    canvas.height = canvas.clientHeight;
    canvas.width = canvas.clientWidth;
});

window.addEventListener('load', (event) => {
    let canvas = document.getElementById("live-timing-map");
    canvas.height = canvas.clientHeight;
    canvas.width = canvas.clientWidth;
});

function CreateTableRow(value, index)
{
    let ve = value.telemetry.ve.toFixed(1) + "%";
    let manufacturer = value.manufacturer;

    let int = value.delta_to_next.toFixed(1);
    let gap = value.delta_to_class_leader.toFixed(1)

    if (value.laps_behind_class_leader > 0)
    {
        gap = value.laps_behind_class_leader + "L";
    }

    if (value.telemetry.ve <= 0.0)
    {
        ve = value.telemetry.fuel.toFixed(1) + "L";
    }

    if (manufacturer.trim().length == 0)
    {
        manufacturer = "Default";
    }

    let speed_under_50kmh = "";
    let in_pits_background = "";

    if (value.telemetry.speed < 50.0 && !value.in_pits)
    {
        speed_under_50kmh = "class='speed-under-50-kmh'";
    }

    if (value.in_pits)
    {
        in_pits_background = "class='vehicle-in-pits'";
    }

    return `<tr class="standings-row-color-${index % 2 + 1}">
        <td>${value.race_position}</td>
        <td>${value.race_position_class}</td>
        <td>${value.vehicle_number}</td>
        <td style="color: ${getColorDefault(value.vehicle_class, "rgb(224, 224, 224)")}">${value.vehicle_class}</td>
        <td><img alt="" width="24" src="../shared/img/brandlogo/${manufacturer}.png"</td>
        <td ${speed_under_50kmh}>${value.driver}</td>
        <td>${value.vehicle_name}</td>
        <td ${in_pits_background}>${value.status}</td>
        <td>${LaptimeToString(value.current_lap)}</td>
        <td>${LaptimeToString(value.last_lap)}</td>
        <td>${LaptimeToString(value.best_lap)}</td>
        <td>${int}</td>
        <td>${gap}</td>
        <td>${ve}</td>
        <td>${GetPenalties(value)}</td>
    </tr>`;
}

let callBacks =
{
    onStandingsUpdate : function(data)
    {
        content = "";
        let style_idx = 0;
        for (let i = 0; i < data.length; i++)
        {
            content += CreateTableRow(data[i], style_idx++);
        }

        let table = document.getElementById("live-timing-table");
        table.innerHTML = content;

        let canvas = document.getElementById("live-timing-map");
        DrawLineMap(data, canvas);
    },
    onSessionUpdate : function(data)
    {
        document.getElementById("session-name").innerHTML = data.name;
        document.getElementById("session-time").innerHTML = SessionTimeString(data);

        document.getElementById("track-name").innerHTML = data.trackName;
        document.getElementById("track-status").innerHTML = SessionTrackStatusString(data);

        document.getElementById("weather-value").innerHTML = SessionTemperatureString(data);
    },
    onControlsUpdate : function(data)
    {
    },
    onTrackMapUpdate : function(data)
    {
    },
    onOverlayUpdate : function(data)
    {
    }
};

let webSocketWrapper = new WebSocketWrapper("ws://" + window.location.hostname + ":6433");
webSocketWrapper.setCallback(callBacks);
webSocketWrapper.connect();
