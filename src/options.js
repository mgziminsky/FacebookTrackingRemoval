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

    Copyright (C) 2016-2021 Michael Ziminsky
*/
/* global app, RATE_LIMIT, refreshRules, getMessageSafe */

'use strict';


app.init().then(() => {
    // Expert Options
    const modStyle = document.getElementById("modStyle");
    const preview = document.getElementById("preview");

    // Set version text
    document.title = `${getMessageSafe("optsTitle")} - v${browser.runtime.getManifest().version}`;
    document.getElementById("legend").append(` - v${browser.runtime.getManifest().version}`);

    {
        const userRules = document.getElementById("userRules");
        userRules.title = getMessageSafe("optsUserRulesHover");
        userRules.placeholder = getMessageSafe("optsUserRulesPlaceholder");
    }

    /** @param {Event} e */
    const handleCheckbox = e => { app.options[e.target.id] = e.target.checked; };
    for (let checkbox of document.querySelectorAll("input[type=checkbox]")) {
        checkbox.addEventListener("change", handleCheckbox);
    }

    /** @param {Event} e */
    const handleRadio = e => { app.options[e.target.name] = e.target.value; };
    for (let checkbox of document.querySelectorAll("input[type=radio]")) {
        checkbox.addEventListener("change", handleRadio);
    }

    /** @param {Event} e */
    const handleText = e => {
        e.target.value = e.target.value.trim();
        if (!e.target.value) {
            app.options.reset(e.target.id);
        } else {
            app.options[e.target.id] = e.target.value;
        }
    };
    for (let text of document.querySelectorAll("input[type=text],textarea")) {
        text.addEventListener("change", handleText);
    }

    document.getElementById("reset").addEventListener("click", _ => app.options.reset().then(() => document.body.classList.add("resetDone")));

    modStyle.addEventListener("input", e => preview.style.cssText = e.target.value);

    /** @param {Event} e */
    const handleToggle = e => { document.getElementById(e.target.dataset.toggle).classList.toggle("hidden", !e.target.checked); };

    // Avoid duplicated event listeners
    const dependFuncs = new Map();

    const init = () => {
        const opts = app.options;
        for (let key in opts) {
            const value = opts[key];
            const item = document.getElementById(key);
            if (item) {
                if (item.type === "checkbox") {
                    item.checked = value;
                } else if (item.type === "text" || item.tagName === "TEXTAREA") {
                    if (!item.placeholder)
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
            handleToggle.call(undefined, { target: checkbox });
        }
    };
    init();

    // Per-option reset functionality
    /** @param {MouseEvent} e */
    const resetField = e => {
        e.preventDefault();
        const option = e.target.parentNode.querySelector("input[id],textarea[id],input[name]");
        app.options.reset(option.id || option.name)
            .then(() => e.target.parentNode.classList.add("resetDone"));
    };
    for (let reset of document.querySelectorAll("btn-reset")) {
        const content = document.importNode(document.getElementById("btnReset").content, true);
        content.firstElementChild.addEventListener("click", resetField);
        reset.parentNode.replaceChild(content, reset);
    }
    document.body.addEventListener("animationend", e => e.target.classList.remove("resetDone"));


    // Refresh button
    {
        const reloadTabs = () => browser.runtime.sendMessage("RELOAD");
        const btnRefresh = document.getElementById("btnRefresh");
        const btnText = btnRefresh.textContent;
        btnRefresh.title = browser.i18n.getMessage("optsRefreshHover", [RATE_LIMIT / 1000 / 60]);

        let timer;
        let disabled = false;

        const resetBtn = () => {
            clearInterval(timer);
            timer = null;
            btnRefresh.textContent = btnText;
            btnRefresh.disabled = disabled = false;
        };

        const btnRefreshTimer = () => {
            resetBtn();
            refreshRules({ check: true }).then(timeout => {
                if (timeout <= 0)
                    return;

                let remaining = Math.ceil(timeout / 1000);

                btnRefresh.disabled = disabled = true;
                btnRefresh.textContent = `${btnText} - ${remaining--} seconds`;

                timer = setInterval(() => {
                    if (remaining <= 0) {
                        resetBtn();
                    } else {
                        btnRefresh.textContent = `${btnText} - ${remaining--} seconds`;
                    }
                }, 1000);
            });
        };

        btnRefreshTimer();
        btnRefresh.addEventListener("click", e => {
            btnRefresh.disabled = disabled = true;
            refreshRules({ force: e.ctrlKey }).then(reloadTabs).then(btnRefreshTimer).catch(() => { });
        });

        window.addEventListener("keydown", e => {
            if (!e.repeat && e.key === "Control") {
                btnRefresh.classList.add("ctrl");
                btnRefresh.disabled = false;
            }
        });
        window.addEventListener("keyup", e => {
            if (e.key === "Control") {
                btnRefresh.classList.remove("ctrl");
                btnRefresh.disabled = disabled;
            }
        });
    }


    // Keep in sync with other options pages
    browser.storage.onChanged.addListener(() => app.init().then(init));

    // Tell the background script a new options window was opened
    browser.runtime.sendMessage("OPTIONS");
}, console.warn);
