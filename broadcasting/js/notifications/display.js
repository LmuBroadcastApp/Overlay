/**
 * @file Notification rendering and queue management for the broadcasting overlay.
 */

/**
 * Displays animated notification cards and serializes them per notification stream.
 */
class NotificationSystem
{
    /**
     * Creates the notification renderer.
     *
     * @param {string} containerId DOM id of the notification container.
     */
    constructor(containerId)
    {
        this.container = document.getElementById(containerId);
        this.active = {};
        this.queue = {};
    }

    /**
     * Queues or immediately shows a notification payload.
     *
     * @param {Object} param0 Notification definition.
     */
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

    /**
     * Builds a fastest-lap notification card.
     *
     * @param {Object} message Notification message payload.
     * @returns {string} Notification HTML.
     */
    _fastLap(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let TIME = LaptimeToString(message.best_lap);
        let CLASS = message.vehicle_class;
        let NAME = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='notification-cell-padding'>Fastest lap</span>
                <span class='notification-cell-padding'>New Record</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type notification-cell-padding notification-overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number notification-cell-padding notification-overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data fast-lap'>
                    <span class='name notification-overflow notification-cell-padding'>${NAME}</span>
                    <span class='notification-cell-padding'>${TIME}</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * Builds a penalty notification card.
     *
     * @param {Object} message Notification message payload.
     * @returns {string} Notification HTML.
     */
    _penalty(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let PENALTY = message.penalty;
        let TYPE = message.type;
        let DRIVER = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='notification-cell-padding'>Penalty</span>
                <span class='notification-cell-padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type notification-cell-padding notification-overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number notification-cell-padding notification-overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data penalty'>
                    <span class='name notification-overflow notification-cell-padding'>${DRIVER}</span>
                    <span class='notification-cell-padding'>${PENALTY}</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * Builds a track-limits notification card.
     *
     * @param {Object} message Notification message payload.
     * @returns {string} Notification HTML.
     */
    _trackLimits(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let PENALTY = message.penalty;
        let TYPE = message.type;
        let DRIVER = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='notification-cell-padding'>Warning</span>
                <span class='notification-cell-padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type notification-cell-padding notification-overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number notification-cell-padding notification-overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data track-limits'>
                    <span class='name notification-overflow notification-cell-padding'>${DRIVER}</span>
                    <span class='notification-cell-padding'>${PENALTY}</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * Builds an incident notification card.
     *
     * @param {Object} message Notification message payload.
     * @returns {string} Notification HTML.
     */
    _impact(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let IMPACT = message.impact;
        let TYPE = message.type;
        let DRIVER = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='notification-cell-padding'>Incident</span>
                <span class='notification-cell-padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type notification-cell-padding notification-overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number notification-cell-padding notification-overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data track-limits'>
                    <span class='name notification-overflow notification-cell-padding'>${DRIVER}</span>
                    <span class='notification-cell-padding'>${IMPACT}</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * Builds a class winner notification card.
     *
     * @param {Object} message Notification message payload.
     * @returns {string} Notification HTML.
     */
    _raceWinner(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let CLASS = message.vehicle_class;
        let DRIVER = message.driver;
        let TYPE = message.type;
        let GAP = message.gap;

        return `<div class='notification-entry winner-entry'>
            <div class='header'>
                <span class='notification-cell-padding'>🏁 Winner</span>
                <span class='notification-cell-padding'>${TYPE}</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type notification-cell-padding notification-overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number notification-cell-padding notification-overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data race-winner'>
                    <span class='name notification-overflow notification-cell-padding'>${DRIVER}</span>
                    <span class='notification-cell-padding'>+${GAP}s</span> <!-- gap to P2 -->
                </div>
            </div>
        </div>`;
    }

    /**
     * Builds a projected best-lap notification card.
     *
     * @param {Object} message Notification message payload.
     * @returns {string} Notification HTML.
     */
    _possibleBestLap(message)
    {
        let VEHICLE_NUMBER = message.vehicle_number;
        let TIME = LaptimeToString(message.projected_lap);
        let CLASS = message.vehicle_class;
        let NAME = message.driver;

        return `<div class='notification-entry'>
            <div class='header'>
                <span class='notification-cell-padding'>Qualifying</span>
                <span class='notification-cell-padding'>On a flyer</span>
            </div>
            <div class='info'>
                <div class='${CLASS} class-type notification-cell-padding notification-overflow'>
                    ${CLASS}
                </div>
                <div class='vehicle-number notification-cell-padding notification-overflow'>
                    #${VEHICLE_NUMBER}
                </div>
                <div class='vehicle-data possible-best-lap'>
                    <span class='name notification-overflow notification-cell-padding'>${NAME}</span>
                    <span class='notification-cell-padding'>${TIME}</span>
                </div>
            </div>
        </div>`;
    }

    /**
     * Builds a generic text notification.
     *
     * @param {string} message Text to show.
     * @returns {string} Notification HTML.
     */
    _message(message)
    {
        return `<div class='message'>${message}</div>`;
    }

    /**
     * Dequeues and shows the next pending notification for one stream id.
     *
     * @param {string} id Notification stream id.
     */
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
        else if (type == 'possible-best-lap')
        {
            notification.innerHTML = this._possibleBestLap(next.message);
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

    /**
     * Starts the removal animation for the active notification in one stream.
     *
     * @param {string} id Notification stream id.
     */
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
