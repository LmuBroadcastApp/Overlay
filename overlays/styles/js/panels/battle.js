class BattlePanel
{
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`BattlePanel: Element ${selector} not found`);
            return;
        }

        this.BATTLE_ENTER_THRESHOLD = 2.0;
        this.BATTLE_EXIT_THRESHOLD = 2.5;
        this.HIDE_DELAY_MS = 1000;

        this.VERY_CLOSE_GAP = 0.5;
        this.CLOSE_GAP = 2.0;

        this.inBattle = false;
        this.timer = null;

        this.standings = null;
        this.session = null;

        this.stateManager.subscribe(this.handleStateChange.bind(this));
    }

    handleStateChange(key, value)
    {
        if (key === 'standings')
        {
            this.standings = value;
        }
        else if (key === 'session')
        {
            this.session = value;
        }
    }

    update()
    {
        if (this.standings == null)
        {
            this.element.style.display = "none";
            return;
        }

        if (this.session && this.session.replayActive)
        {
            this.element.style.display = "none";
            return;
        }

        const now = Date.now();
        const battles = this.findBattles(this.standings);

        if (battles.length === 0)
        {
            if (!this.timer)
            {
                this.timer = now + this.HIDE_DELAY_MS;
            }

            if (now >= this.timer)
            {
                this.element.style.display = "none";
                this.timer = null;
            }

            return;
        }

        // Active battle → show immediately and cancel hide timer
        this.timer = null;

        this.element.style.display = "block";
        this.renderBattles(battles);
    }

    findBattles(standings)
    {
        let sorted = [...standings].sort((a, b) => b.spline - a.spline);
        let idx = StandingsGetFocusIdx(sorted);

        if (idx < 0)
        {
            this.inBattle = false;
            return [];
        }

        const threshold = this.inBattle ? this.BATTLE_EXIT_THRESHOLD : this.BATTLE_ENTER_THRESHOLD;
        let battles = [];

        if (Math.abs(sorted[idx].relative_delta_to_next) < threshold)
        {
            if (idx > 0)
            {
                battles.push(sorted[idx - 1]);
                battles.push(sorted[idx - 0]);
            }
        }

        if (Math.abs(sorted[idx].relative_delta_to_prev) < threshold)
        {
            if (idx < (sorted.length - 1))
            {
                if (battles.length == 0)
                {
                    battles.push(sorted[idx + 0]);
                }
                battles.push(sorted[idx + 1]);
            }
        }

        this.inBattle = battles.length > 0;
        return battles;
    }

    getBattlePenalty(vehicle)
    {
        if (vehicle.status == "DNF" || vehicle.status == "DQ")
        {
            return "";
        }

        let parts = [];
        if (vehicle.penalties?.drive_through > 0) parts.push("<span class='penalty-style'>DT</span>");
        if (vehicle.penalties?.stop_and_go > 0) parts.push("<span class='penalty-style'>SG</span>");
        if (vehicle.penalties?.time_penalty > 0) parts.push("<span class='penalty-style'>+" + vehicle.penalties.time_penalty + "</span>");
        return parts.join('');
    }

    getBattleTires(vehicle)
    {
        if (!vehicle.tire_compound)
        {
            return "";
        }

        if (HasOneTireCompound(vehicle))
        {
            let tire = "(" + vehicle.tire_compound[0][0] + ")";
            return `<span style="color: ${TireCompoundColor(vehicle.tire_compound[0])}">${tire}</span>`;
        }

        return `<span style="font-size: 0.65em;">
            <span style="color: ${TireCompoundColor(vehicle.tire_compound[0])}"></span>
            <span style="margin-left: 2px; color: ${TireCompoundColor(vehicle.tire_compound[1])}"></span>
            <span style="color: ${TireCompoundColor(vehicle.tire_compound[2])}"></span>
            <span style="margin-left: 2px; color: ${TireCompoundColor(vehicle.tire_compound[3])}"></span>
        </span>`;
    }

    getBattleFirstCol(vehicle)
    {
        if (vehicle.in_pits)
        {
            return { content: "<span style='color: #1a1a1a;'>PIT</span>", style: "background-color: rgb(249, 199, 79); min-width: 32px;" };
        }

        if (!vehicle.in_pits && vehicle.telemetry?.speed < 50)
        {
            return { content: "<span style='color: #1a1a1a;'></span>", style: "background-color: rgb(249, 199, 79); min-width: 32px;" };
        }

        return { content: "", style: "" };
    }

    renderBattles(battles)
    {
        let html = ''; let idx = -1;
        const len = battles.length;

        battles.forEach((vehicle, index) =>
        {
            if (vehicle?.focus)
            {
                idx = index;
            }
        });

        html += '<div class="battle-header">RELATIVE / BATTLE</div>';
        html += '<table class="battle-table">';
        html += '<tbody>';

        battles.forEach((vehicle, index) =>
        {
            let gapText = '-';
            let gapClass = '';
            const name = vehicle.driver;

            const manufacturerRaw = (vehicle.manufacturer || '').trim();
            const manufacturer = manufacturerRaw.length === 0 ? 'Default' : vehicle.manufacturer;

            if (len == 3)
            {
                if (index == 0)
                {
                    gapText = battles[idx].relative_delta_to_next.toFixed(3);
                }
                else if (index == 2)
                {
                    gapText = '+' + battles[idx].relative_delta_to_prev.toFixed(3);
                }
            }
            else
            {
                if (idx == 0 && index != idx)
                {
                    gapText = '+' + battles[idx].relative_delta_to_prev.toFixed(3);
                }
                else if (idx == 1 && index != idx)
                {
                    gapText = battles[idx].relative_delta_to_next.toFixed(3);
                }
            }

            let gapNum = parseFloat(gapText);
            if (!isNaN(gapNum))
            {
                if (gapNum < this.VERY_CLOSE_GAP) gapClass = 'gap-less-1';
                else if (gapNum < this.CLOSE_GAP) gapClass = 'gap-less-2';
            }

            let firstCol = this.getBattleFirstCol(vehicle);

            html += `<tr class="standings-secondary-color">
                <td style="${firstCol.style}">
                    ${firstCol.content}
                </td>
                <td class="battle-position">
                    P${vehicle.race_position_class}
                </td>
                <td class="battle-driver">
                    <span class="battle-driver-text">${name}</span>
                </td>
                <td class="battle-logo">
                    <img height="20px" alt="" src="styles/img/brandlogo/${manufacturer}.png" />
                </td>
                <td class="battle-number">
                    #${vehicle.vehicle_number}
                </td>
                <td class="battle-gap ${gapClass}">
                    ${gapText}
                </td>
                <td class="battle-tire">
                    ${this.getBattleTires(vehicle)}
                </td>
                <td class="battle-penalty">
                    ${this.getBattlePenalty(vehicle)}
                </td>
                <td class="battle-class overflow-hidden ${CSSClassFromVehicleClass(vehicle.vehicle_class)}">
                    ${vehicle.vehicle_class}
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        this.element.innerHTML = html;
    }
}
