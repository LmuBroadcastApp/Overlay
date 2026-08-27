var g_colorMap = new Map();

function getColorDefault(key, defaultValue)
{
    return g_colorMap.has(key) ? g_colorMap.get(key) : defaultValue;
}

function getRandomColor()
{
    var letters = '0123456789ABCDEF';
    var color = '#';

    for (var i = 0; i < 6; i++)
    {
        color += letters[Math.floor(Math.random() * 16)];
    }

    return color;
}

function DrawLineMap(standings, canvas)
{
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(33, 32, 41, 0.9)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < standings.length; i++)
    {
        if (!g_colorMap.has(standings[i].vehicle_class))
        {
            g_colorMap.set(standings[i].vehicle_class, getRandomColor());
        }

        let x = canvas.width * standings[i].spline;
        let y = canvas.height / 2;
        let radius = y - 4;

        if (standings[i].in_pits)
        {
            radius = radius / 2;
            y = radius;
        }

        ctx.beginPath();
        ctx.arc(x, y, radius , 0, Math.PI * 2, true);
        ctx.fillStyle = g_colorMap.get(standings[i].vehicle_class);
        ctx.fill();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(standings[i].vehicle_number, x, y);
    }
}
