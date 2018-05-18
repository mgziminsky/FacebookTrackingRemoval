/*  This file is part of FacebookTrackingRemoval.

    FacebookTrackingRemoval is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FacebookTrackingRemoval is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FacebookTrackingRemoval.  If not, see <http://www.gnu.org/licenses/>.

    Copyright (C) 2016-2018 Michael Ziminsky
*/

'use strict';
app.init().then(() => {
    const optionsElem = document.getElementById("options");
    // Standard Options
    const fixLinks   = document.getElementById("fixLinks");
    const inlineVids = document.getElementById("inlineVids");
    const useStyle   = document.getElementById("useStyle");
    // Expert Options
    const modStyle = document.getElementById("modStyle");
    const preview  = document.getElementById("preview");

    // Set version text
    document.title += ` - v${browser.runtime.getManifest().version}`;
    document.getElementById("legend").textContent += ` - v${browser.runtime.getManifest().version}`;

    function handleCheckbox() { app.options[this.id] = this.checked; }
    for (let checkbox of document.querySelectorAll("input[type=checkbox]")) {
        checkbox.addEventListener("change", handleCheckbox);
    }

    function handleRadio() { app.options[this.name] = this.value; }
    for (let checkbox of document.querySelectorAll("input[type=radio]")) {
        checkbox.addEventListener("change", handleRadio);
    }

    fixLinks.addEventListener("change", e => inlineVids.disabled = !e.target.checked);
    useStyle.addEventListener("change", e => modStyle.disabled   = !e.target.checked);

    document.getElementById("enabled").addEventListener("change", e => optionsElem.classList.toggle("hidden", !e.target.checked));

    document.getElementById("reset").addEventListener("click", () => {
        app.options.reset();
        init();
    });

    modStyle.addEventListener("change", e => {
        const target = e.target;
        app.options[target.id] = target.value;
        preview.style.cssText = target.value;
    });

    function init() {
        const opts = app.options;
        for (let key in opts) {
            const value = opts[key];
            const item = document.getElementById(key);
            if (item) {
                if (item.type === "checkbox")
                    item.checked = value;
                else
                    item.value = value;
            } else {
                const radio = document.querySelector("input[name=" + key + "][value=" + value + "]");
                if (radio)
                    radio.checked = true;
            }
        }

        preview.style.cssText = modStyle.value;

        inlineVids.disabled = !fixLinks.checked;
        modStyle.disabled   = !useStyle.checked;

        optionsElem.classList.toggle("hidden", !opts.enabled);
    }
    init();

    // Keep in sync with other options pages
    browser.storage.onChanged.addListener(() => app.init().then(init));

    // Tell the background script a new options window was opened
    browser.runtime.sendMessage("OPTIONS");
}, console.log);
