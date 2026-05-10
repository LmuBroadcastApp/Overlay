class NotificationSystem
{
    constructor(containerId)
    {
        this.container = document.getElementById(containerId);
        this.active = {};
        this.queue = {};
    }

    show({ type = undefined, subtype = undefined, message = undefined, duration = 3000 })
    {
        if (type == undefined)
        {
            console.log('Notification type is required');
            return
        }

        if (message == undefined)
        {
            console.log('Message is required');
            return;
        }

        let id = type;
        if (subtype != undefined) id = type + "|" + subtype;

        if (!this.queue[id] || type == 'fast-lap')
        {
            this.queue[id] = [];
        }

        this.queue[id].push
        (
            { message, duration }
        );

        if (!this.active[id])
        {
            this._showNext(id);
        }
    }

    _fastLap(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let TIME = LaptimeToString(message.best_lap);
        let CLASS = message.vehicle_class;
        let NAME = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='padding'>Fastest lap</span>
                <span class='padding'>New Record</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type padding overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number padding overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data fast-lap'>
                    <span class='name overflow padding'>${NAME}</span>
                    <span class='padding'>${TIME}</span>
                </div>
            </div>
        </div>`;
    }

    _penalty(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let PENALTY = message.penalty;
        let TYPE = message.type;
        let DRIVER = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='padding'>Penalty</span>
                <span class='padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type padding overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number padding overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data penalty'>
                    <span class='name overflow padding'>${DRIVER}</span>
                    <span class='padding'>${PENALTY}</span>
                </div>
            </div>
        </div>`;
    }

    _trackLimits(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let PENALTY = message.penalty;
        let TYPE = message.type;
        let DRIVER = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='padding'>Warning</span>
                <span class='padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type padding overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number padding overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data track-limits'>
                    <span class='name overflow padding'>${DRIVER}</span>
                    <span class='padding'>${PENALTY}</span>
                </div>
            </div>
        </div>`;
    }

    _impact(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let IMPACT = message.impact;
        let TYPE = message.type;
        let DRIVER = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='padding'>Incident</span>
                <span class='padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type padding overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number padding overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data track-limits'>
                    <span class='name overflow padding'>${DRIVER}</span>
                    <span class='padding'>${IMPACT}</span>
                </div>
            </div>
        </div>`;
    }

    _raceWinner(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let DRIVER = message.driver;
        let TYPE = message.type;
        let GAP = message.gap;

        return `<div class='notification-entry winner-entry'>
            <div class='header'>
                <span class='padding'>🏁 Winner</span>
                <span class='padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type padding overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number padding overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data race-winner'>
                    <span class='name overflow padding'>${DRIVER}</span>
                    <span class='padding'>+${GAP}s</span> <!-- gap to P2 -->
                </div>
            </div>
        </div>`;
    }

    _message(message)
    {
        return `<div class='message'>${message}</div>`;
    }

    _showNext(id)
    {
        const splits = id.split("|");
        let subtype = splits[1];
        let type = splits[0];

        const next = this.queue[id]?.shift();
        if (!next)
        {
            this.active[id] = null;
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification`;

        if (type == 'track-limits')
        {
            notification.innerHTML = this._trackLimits(next.message);
        }
        else if (type == 'impact')
        {
            notification.innerHTML = this._impact(next.message);
        }
        else if (type == 'fast-lap')
        {
            notification.innerHTML = this._fastLap(next.message);
        }
        else if (type == 'penalty')
        {
            notification.innerHTML = this._penalty(next.message);
        }
        else if (type == 'winner')
        {
            notification.innerHTML = this._raceWinner(next.message);
        }
        else
        {
            notification.innerHTML = this._message(next.message);
        }

        this.container.appendChild(notification);
        this.active[id] = notification;

        requestAnimationFrame(() =>
        {
            notification.classList.add('show');
        });

        notification.timeout = setTimeout(() =>
        {
            this._remove(id);
        }, next.duration);
    }

    _remove(id)
    {
        const notification = this.active[id];
        if (!notification) return;

        clearTimeout(notification.timeout);
        notification.classList.remove('show');

        setTimeout(() =>
        {
            notification.remove();
            this.active[id] = null;
            this._showNext(id);
        }, 300);
    }
}
