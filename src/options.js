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

    Copyright (C) 2016-2020 Michael Ziminsky
*/

'use strict';
app.init().then(() => {
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

    function handleText() {
        this.value = this.value.trim();
        if (!this.value) {
            app.options.reset(this.id);
        } else {
            app.options[this.id] = this.value;
        }
    }
    for (let text of document.querySelectorAll("input[type=text],textarea")) {
        text.addEventListener("change", handleText);
    }

    document.getElementById("reset").addEventListener("click", _ => app.options.reset().then(() => document.body.classList.add("resetDone")));

    modStyle.addEventListener("change", e => preview.style.cssText = this.value);

    function handleToggle() { document.getElementById(this.dataset.toggle).classList.toggle("hidden", !this.checked); }

    // Avoid duplicated event listeners
    const dependFuncs = new Map();

    function init() {
        const opts = app.options;
        for (let key in opts) {
            const value = opts[key];
            const item = document.getElementById(key);
            if (item) {
                if (item.type === "checkbox") {
                    item.checked = value;
                } else if (item.type === "text" || item.tagName === "TEXTAREA") {
                    item.placeholder = app.defaults[key];
                    item.value = value;
                } else {
                    item.value = value;
                }
            } else {
                const radio = document.querySelector("input[name=" + key + "][value=" + value + "]");
                if (radio)
                    radio.checked = true;
            }
        }

        preview.style.cssText = modStyle.value;

        for (let elem of document.querySelectorAll("[data-depends]")) {
            const source = document.getElementById(elem.dataset.depends);

            if (!dependFuncs.has(elem))
                dependFuncs.set(elem, () => elem.disabled = !source.checked);

            source.addEventListener("change", dependFuncs.get(elem));
            elem.disabled = !source.checked;
        }

        for (let checkbox of document.querySelectorAll("input[data-toggle]")) {
            checkbox.addEventListener("change", handleToggle);
            handleToggle.apply(checkbox);
        }
    }
    init();

    // Per-option reset functionality
    function resetField(e) {
        e.preventDefault();
        const option = this.parentNode.querySelector("input[id],textarea[id],input[name]");
        app.options.reset(option.id || option.name)
            .then(() => this.parentNode.classList.add("resetDone"));
    };
    for (let reset of document.querySelectorAll("btn-reset")) {
        const content = document.importNode(document.getElementById("btnReset").content, true);
        content.firstElementChild.addEventListener("click", resetField);
        reset.parentNode.replaceChild(content, reset);
    }
    document.body.addEventListener("animationend", e => e.target.classList.remove("resetDone"));


    // Refresh button
    {
        const btnRefresh = document.getElementById("btnRefresh");
        btnRefresh.title = browser.i18n.getMessage("optsRefreshHover", RATE_LIMIT / 1000 / 60);

        let timer;
        function btnRefreshTimer() {
            if (timer)
                return;

            refreshRules({check: true}).then(timeout => {
                if (timeout <= 0)
                    return;

                let remaining = Math.ceil(timeout / 1000);
                const text = btnRefresh.textContent;

                btnRefresh.disabled = true;
                btnRefresh.textContent = `${text} - ${remaining--} seconds`;

                timer = setInterval(() => {
                    if (remaining <= 0) {
                        clearInterval(timer);
                        timer = null;
                        btnRefresh.textContent = text;
                        btnRefresh.disabled = false;
                    } else {
                        btnRefresh.textContent = `${text} - ${remaining--} seconds`;
                    }
                }, 1000);
            });
        }

        btnRefreshTimer();
        btnRefresh.addEventListener("click", e => refreshRules({force: e.ctrlKey}).then(app.reloadTabs).then(btnRefreshTimer, btnRefreshTimer));

        window.addEventListener("keydown", e => {
            if (!e.repeat && e.key === "Control")
                btnRefresh.classList.add("ctrl");
        });
        window.addEventListener("keyup", e => {
            if (e.key === "Control")
                btnRefresh.classList.remove("ctrl");
        });

    }


    // Keep in sync with other options pages
    browser.storage.onChanged.addListener(() => app.init().then(init));

    // Tell the background script a new options window was opened
    browser.runtime.sendMessage("OPTIONS");
}, console.log);
