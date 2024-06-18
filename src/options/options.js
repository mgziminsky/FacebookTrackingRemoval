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

    Copyright (C) 2016-2024 Michael Ziminsky
*/

import { isChrome } from "../common.js";
import * as config from "../config.js";
import { CHROME_PORT, MSG, NOOP, RATE_LIMIT } from "../consts.js";
import getMessageSafe from "../i18n.js";
import { timeoutRemaining } from "../rules_sync.js";

//
/** @type {browser.runtime.Port} */
let bgPort;
if (isChrome) bgPort = browser.runtime.connect({ name: CHROME_PORT });

/** @type {Options} */
const changes = new Proxy(
    {},
    {
        set(obj, key, val) {
            if (config.options[key] === val) {
                delete obj[key];
            } else {
                // Force undefined to null. undefined values don't get sent by postMessage
                obj[key] = val ?? null;
            }
            if (bgPort) bgPort.postMessage(obj);
            return true;
        },
    },
);

// Only works in FF... https://bugs.chromium.org/p/chromium/issues/detail?id=31262
window.addEventListener("unload", () => {
    if (Object.keys(changes).length) Object.assign(config.options, changes);
});

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

// Set max value for sensitivity slider
{
    const slider = document.getElementById("canvasSensitivity");
    slider.max = config.MAX_CANVAS_SENSITIVITY;
    slider.title = getMessageSafe("optsSenseHover");
}

/** @param {Event} e */
function handleChange(e) {
    switch (e.target.type) {
        case "checkbox":
            changes[e.target.id] = e.target.checked;
            break;
        case "radio":
            changes[e.target.name] = e.target.value;
            break;
        case "text":
        case "textarea":
            e.target.value = e.target.value.trim();
            if (!e.target.value) {
                changes[e.target.id] = undefined;
            } else {
                changes[e.target.id] = e.target.value;
            }
            break;
        default:
            changes[e.target.id] = e.target.value;
            break;
    }
}
for (const text of document.querySelectorAll("input,textarea")) {
    text.addEventListener("change", handleChange);
}

document
    .getElementById("reset")
    .addEventListener("click", _ => config.reset().then(() => document.body.classList.add("resetDone")));

modStyle.addEventListener("input", e => (preview.style.cssText = e.target.value));

/** @param {Event} e */
function handleToggle(e) {
    document.getElementById(e.target.dataset.toggle).classList.toggle("hidden", !e.target.checked);
}

/**
 * @param {Element} elem
 * @param {string} name
 * @param {*} value
 */
function findRadio(elem, name, value) {
    return elem.querySelector(`input[name=${name}][value=${value}]`);
}

// Per-option reset functionality
window.customElements.define(
    "btn-reset",
    class extends HTMLElement {
        constructor() {
            super();
            const img = this.attachShadow({ mode: "open" }).appendChild(document.createElement("img"));
            img.src = "reset.svg";
            img.alt = getMessageSafe("optsResetAlt");
            img.title = getMessageSafe("optsResetTitle");
            this.addEventListener("click", this.reset.bind(this));
        }

        /** @param {MouseEvent} e */
        reset(e) {
            e?.preventDefault();
            const option = this.parentNode.querySelector("input[id],textarea[id],input[name]");
            const key = option.id || option.name;
            changes[key] = null;
            switch (option.type) {
                case "radio":
                    findRadio(this.parentNode, key, config.defaults[key]).checked = true;
                    break;
                case "checkbox":
                    option.checked = config.defaults[key];
                    break;
                default:
                    option.value = config.defaults[key];
                    break;
            }
            this.parentNode.classList.add("resetDone");
        }
    },
);
document.body.addEventListener("animationend", e => e.target.classList.remove("resetDone"));

// Refresh button
{
    const btnRefresh = document.getElementById("btnRefresh");
    const btnText = getMessageSafe("optsRefresh");
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
        timeoutRemaining().then((timeout = 0) => {
            if (timeout <= 0) return;

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
        btnRefresh.classList.remove("ctrl");
        browser.runtime.sendMessage({ msg: MSG.rulesRefresh, force: e.ctrlKey }).then(btnRefreshTimer).catch(NOOP);
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
config.onChanged.addListener(init);

// Avoid duplicated event listeners
const dependFuncs = new Map();

function init() {
    for (const key in changes) {
        delete changes[key];
    }

    const opts = config.options;
    for (const key in opts) {
        const value = opts[key];
        const item = document.getElementById(key);
        if (item) {
            if (item.type === "checkbox") {
                item.checked = value;
            } else if (item.type === "text" || item.tagName === "TEXTAREA") {
                if (!item.placeholder) item.placeholder = config.defaults[key];
                item.value = value;
            } else {
                item.value = value;
            }
        } else {
            const radio = findRadio(document, key, value);
            if (radio) radio.checked = true;
        }
    }

    preview.style.cssText = modStyle.value;

    for (const elem of document.querySelectorAll("[data-depends]")) {
        const source = document.getElementById(elem.dataset.depends);

        if (!dependFuncs.has(elem)) dependFuncs.set(elem, () => (elem.disabled = !source.checked));

        source.addEventListener("change", dependFuncs.get(elem));
        elem.disabled = !source.checked;
    }

    for (const checkbox of document.querySelectorAll("input[data-toggle]")) {
        checkbox.addEventListener("change", handleToggle);
        handleToggle.call(undefined, { target: checkbox });
    }
}
config.READY.then(init);
