class TowerPanel
{
    constructor(selector, stateManager)
    {
        this.element = document.querySelector(selector);
        this.stateManager = stateManager;

        if (!this.element)
        {
            console.error(`TowerPanel: Element ${selector} not found`);
            return;
        }

        this.vehicle_control = new Map();
        this.stateManager.subscribe(this.handleStateChange.bind(this));

        this.session = null;
        this.standings = null;

        this.controls =
        {
            update_rate: 3,
            static_entries: 5,
            dynamic_entries: 5,
            gap_mode: "leader",
            name_source: "driver",
            driver_name: "short",
            right_column: "energy",
            vehicle_class: "multiclass"
        };
    }

    handleStateChange(key, value)
    {
        if (key === 'session')
        {
            this.session = value.trackName !== "" ? value : null;
        }
        else if (key === 'standings')
        {
            this.standings = value;
        }
        else if (key === 'controls')
        {
            this.vehicle_control.clear();
            this.controls = value;
        }
    }

    update()
    {
        this.element.innerHTML = '';

        if (this.standings == null || this.session == null)
        {
            return
        }

        if (this.controls.vehicle_class.toLowerCase() == "multiclass")
        {
            this.showMultiClass();
        }
        else
        {
            this.showOneClass();
        }
    }

    hasPenalty(vehicle)
    {
        let dt = vehicle.penalties.drive_through;
        let tp = vehicle.penalties.time_penalty;
        let sg = vehicle.penalties.stop_and_go;
        return dt > 0 || sg > 0 || tp > 0;
    }

    getRaceFlags(vehicle)
    {
        let flag_txt = "";

        if (vehicle.in_pits && vehicle.status != "Finished" && vehicle.status != "DNF" && vehicle.status != "DQ")
        {
            flag_txt += "<span class='vehicle-in-pits'>PIT</span>";
        }

        if (vehicle.status == "Finished")
        {
            flag_txt = "<span><img alt='finish-flag' height='23' src='styles/img/others/flag_finish.jpg'/></span>";
        }

        return flag_txt == "" ? "" : `<td>${flag_txt}</td>`;
    }

    getPenalty(vehicle)
    {
        let penalty_txt = "";

        if (vehicle.status == "DNF" || vehicle.status == "DQ")
        {
            return "";
        }

        if (vehicle.penalties.drive_through > 0)
        {
            penalty_txt += "<span class='penalty-style'>DT</span>";
        }

        if (vehicle.penalties.stop_and_go > 0)
        {
            penalty_txt += "<span class='penalty-style'>SG</span>";
        }

        if (vehicle.penalties.time_penalty > 0)
        {
            penalty_txt += "<span class='penalty-style'>+" + vehicle.penalties.time_penalty + "</span>";
        }

        return penalty_txt == "" ? "" : `<td>${penalty_txt}</td>`;
    }

    createRow(vehicle, position, isRace, tableRow, bestLap, rightColumn)
    {
        let name = VehicleGetName(vehicle, this.controls, isRace);
        let gap = VehicleGetGap(vehicle, this.controls, isRace);
        let fuel_ve = GetVehicleFuelVe(vehicle);

        let manufacturer = vehicle.manufacturer;
        let firstColBackground = "";
        let firstColImg = "";

        let selected_color = "";
        let gap_color = "";

        if(this.controls.gap_mode.toLowerCase() == "ahead" && isRace && position > 1)
        {
            if (gap < 2)
            {
                gap_color = "gap-less-2";
            }

            if (gap < 0.5)
            {
                gap_color = "gap-less-1";
            }
        }

        if (position == 1)
        {
            gap = "-";
        }

        if (vehicle.focus)
        {
            selected_color = "color-selected";
        }

        if (manufacturer.trim().length == 0)
        {
            manufacturer = "Default";
        }

        if (!vehicle.in_pits && vehicle.telemetry.speed < 50)
        {
            firstColBackground = "style='background-color: rgb(249, 199, 79)'";
            firstColImg = "<span class='icon-container' style='color: #1a1a1a;'></span>";
        }
        else if (vehicle.slot_id == bestLap.id)
        {
            firstColBackground = "style='background-color: #0076D7;'";
            firstColImg = "<span class='icon-container'>󰔛</span>";
        }

        let right_column_content = "";
        let tr = `<tr class="${selected_color}">
                    <td class="vehicle-icons" ${firstColBackground}">${firstColImg}</td>
                    <td class="vehicle-position standings-primary-color">${position}</td>
                    <td class="vehicle-driver standings-primary-color"><span class="vehicle-driver-truncate-text">${name}</span></td>
                    <td class="vehicle-logo standings-primary-color"><img height="23px" alt="" src="styles/img/brandlogo/${manufacturer}.png" /></td>
                    <td class="vehicle-number standings-primary-color">#${vehicle.vehicle_number}</td>
                    <td class="vehicle-gap standings-secondary-color ${gap_color}">${gap}</td>
                    <!-- {RIGHT_COLUMNS} -->
                    <!-- {RACE_FLAGS} -->
                    <!-- {ADD_PENALTIES} -->
                </tr>`;

        if (rightColumn == "energy")
        {
            right_column_content = `<td class="vehicle-right-column standings-secondary-color" ${fuel_ve.style}>${fuel_ve.text}</td>`;
        }
        else if(rightColumn == "damage")
        {
            right_column_content = `<td class="vehicle-right-column standings-secondary-color">${vehicle.damage.toFixed(1)}%</td>`;
        }
        else if (rightColumn == "best")
        {
            right_column_content = `<td class="vehicle-right-column standings-secondary-color">${LaptimeToString(vehicle.best_lap)}</td>`;
        }
        else if (rightColumn == "last")
        {
            right_column_content = `<td class="vehicle-right-column standings-secondary-color">${LaptimeToString(vehicle.last_lap)}</td>`;
        }
        else if (rightColumn == "pitstops")
        {
            right_column_content = `<td class="vehicle-right-column standings-secondary-color">${vehicle.pit_stops}</td>`;
        }
        else if (rightColumn == "posgainlost")
        {
            let diff = vehicle.race_position_class - vehicle.qualy_position_class;
            let cls = diff < 0 ? "gain-position" : diff > 0 ? "lost-position" : "";

            let num = String(Math.abs(diff)).padStart(2, '0');
            let diff_pos_txt = "-";

            if (vehicle.qualy_position_class > 0)
            {
                diff_pos_txt = diff > 0 ? "⮟ " + num : diff < 0 ? "⮝ " + num : "-";
            }

            right_column_content = `<td class="vehicle-right-column standings-secondary-color ${cls}">${diff_pos_txt}</td>`;
        }
        else if (rightColumn == "tires")
        {
            if (HasOneTireCompound(vehicle))
            {
                let tire = "(" + vehicle.tire_compound[0][0] + ")";
                right_column_content = `<td class="vehicle-right-column standings-secondary-color" style="color: ${TireCompoundColor(vehicle.tire_compound[0])};">${tire}</td>`;
            }
            else
            {
                right_column_content = `<td class="vehicle-right-column standings-secondary-color" style="font-size: 0.5em;">
                        <span style="color: ${TireCompoundColor(vehicle.tire_compound[0])}"><span>
                        <span style="margin-left: 5px; color: ${TireCompoundColor(vehicle.tire_compound[1])}"><span>
                            <br/>
                        <span style="color: ${TireCompoundColor(vehicle.tire_compound[2])}"><span>
                        <span style="margin-left: 5px; color: ${TireCompoundColor(vehicle.tire_compound[3])}"><span>
                    </td>`;
            }
        }

        tr = tr.replace("<!-- {RIGHT_COLUMNS} -->", right_column_content);
        tr = tr.replace("<!-- {RACE_FLAGS} -->", this.getRaceFlags(vehicle));
        tr = tr.replace("<!-- {ADD_PENALTIES} -->", this.getPenalty(vehicle));
        return tr;
    }

    renderOneStandingsClass(renderInfo)
    {
        let table = "";
        let table_row = 1;
        let gap_txt = "GAP";

        let isRace = renderInfo.isRace;
        let rightColumn = renderInfo.rightColumn;

        let static_entries = renderInfo.static_entries;
        let update_rate = renderInfo.update_rate * 1000;
        let dynamic_entries = renderInfo.dynamic_entries;

        let v = renderInfo.standings;
        let c = renderInfo.vehicle_class;

        let tag = GetRightColumnName(rightColumn, c);
        let bestLap = GetBestLapTime(v);

        if (this.controls.gap_mode.toLowerCase() == "ahead")
        {
            gap_txt = "INT";
        }

        let content = `<thead>
                <tr>
                    <th>
                    </th>
                    <th class="${CSSClassFromVehicleClass(c)}" colspan="4">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="margin: 0 5px auto;">󰶓  &nbsp; ${v.length}</span>
                            <span style="margin: 0 auto;">${c}</span>
                        </div>
                    </th>
                     <th class="standings-secondary-color">
                        ${gap_txt}
                     </th>
                    <th class="standings-secondary-color">${tag}</th>
                </tr>
            </thead><tbody>`;

        if(v.length < static_entries)
        {
            for (let i = 0; i < v.length; i++)
            {
                let row = this.createRow(v[i], i + 1, isRace, table_row++, bestLap, rightColumn);
                content = content.concat(row);
            }

            if (this.vehicle_control.has(c))
            {
                this.vehicle_control.delete(c)
            }

            return table.concat("<table>" + content + "</tbody></table>");
        }

        if (!this.vehicle_control.has(c))
        {
            let opt = { start: static_entries, end: Math.min(v.length, static_entries + dynamic_entries), timestamp: new Date().getTime() };
            this.vehicle_control.set(c, opt);
        }
        let opt = this.vehicle_control.get(c);

        for (let i = 0; i < static_entries; i++)
        {
            let row = this.createRow(v[i], i + 1, isRace, table_row++, bestLap, rightColumn);
            content = content.concat(row);
        }

        content = content.concat("<tr><td></td><td colspan='6' style='background-color: rgba(224, 224, 224, 0.3s); height: 1px;'></td></tr>");

        for (let i = opt.start; i < Math.min(v.length, opt.end); i++)
        {
            let row = this.createRow(v[i], i + 1, isRace, table_row++, bestLap, rightColumn);
            content = content.concat(row);
        }

        if (new Date().getTime() - opt.timestamp > update_rate)
        {
            let new_opt = { start: opt.start + 1, end: opt.end + 1, timestamp: new Date().getTime() };
            if (new_opt.end > v.length)
            {
                new_opt.end = Math.min(v.length, static_entries + dynamic_entries);
                new_opt.start = static_entries;
            }
            this.vehicle_control.set(c, new_opt);
        }

        return table.concat("<table>" + content + "</tbody></table>");
    }

    showOneClass()
    {
        let renderInfo =
        {
            rightColumn: this.controls.right_column.toLowerCase(),
            isRace: this.session.name.toLowerCase().includes("race"),

            update_rate: this.controls.update_rate,
            static_entries: this.controls.static_entries,
            dynamic_entries: this.controls.dynamic_entries,

            vehicle_class: this.controls.vehicle_class,
            standings: GetVehicleOfClass(this.standings, this.controls.vehicle_class)
        }

        let html = this.renderOneStandingsClass(renderInfo);
        this.element.innerHTML = html;
    }

    showMultiClass()
    {
        let html = "";
        for (const [c, s] of GetByClasses(this.standings))
        {
            if (this.session.name == undefined)
            {
                continue;
            }

            let renderInfo =
            {
                rightColumn: this.controls.right_column.toLowerCase(),
                isRace: this.session.name.toLowerCase().includes("race"),

                update_rate: this.controls.update_rate,
                static_entries: this.controls.static_entries,
                dynamic_entries: this.controls.dynamic_entries,

                vehicle_class: c,
                standings: s
            }

            html += this.renderOneStandingsClass(renderInfo);
        }
        this.element.innerHTML = html;
    }
}
