// Copyright (C) 2021-2024 Michael Ziminsky (Z)
//
// This file is part of FacebookTrackingRemoval, originally from ProxyTab.
//
// FacebookTrackingRemoval is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// FacebookTrackingRemoval is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with FacebookTrackingRemoval.  If not, see <http://www.gnu.org/licenses/>.

/**
 * @see {@link browser.i18n.getMessage}
 * @param {string} key
 */
function getMessage(key, ...vars) {
    const msg = browser.i18n.getMessage(key, vars);
    if (!msg) throw `!! Missing Translation - ${key} !!`;

    return msg;
}

function getMessageSafe(key, ...vars) {
    try {
        return getMessage(key, ...vars);
    } catch (e) {
        return e;
    }
}

/**
 * Applies translations declared via attributes to elem
 * @param {HTMLElement} elem
 */
function translate(elem) {
    try {
        const { i18n: key, i18nAttr: attr = "title", i18nVars: vars = "" } = elem.dataset;
        elem.setAttribute(attr, getMessage(key, ...vars.split("||")));
    } catch (e) {
        console.warn("Failed to apply translation to %o:", elem, e);
    }
}

window.customElements.define(
    "fbtr-i18n",
    class extends HTMLElement {
        static get observedAttributes() {
            return ["key"];
        }

        constructor() {
            super();
            for (const child of this.childNodes) {
                if (child.nodeName !== "PARAM") child.remove();
            }

            // NOTE: Shadow DOM plays poorly with accessibility
            this.text = this.attachShadow({ mode: "open" });

            this.observer = new MutationObserver(this.update.bind(this));
        }

        get textContent() {
            return this.text.textContent;
        }

        attributeChangedCallback() {
            this.update();
        }

        connectedCallback() {
            this.observer.observe(this, { childList: true, subtree: true, attributeFilter: ["value"] });
        }

        disconnectedCallback() {
            this.observer.disconnect();
        }

        update() {
            const key = this.getAttribute("key");
            const vars = [...this.getElementsByTagName("param")].map(v => v.value);
            try {
                this.text.innerHTML = getMessage(key, ...vars);
                this.classList.remove("error");
            } catch (e) {
                this.text.textContent = e;
                this.classList.add("error");
            }
        }
    },
);

const I18N_SELECTOR = "[data-i18n]";
document.querySelectorAll(I18N_SELECTOR).forEach(translate);
new MutationObserver(muts => {
    for (const m of muts) {
        if (m.type === "attributes") {
            translate(m.target);
        } else
            for (const e of m.addedNodes) {
                if (e.nodeType !== 1) continue;

                if (e.matches(I18N_SELECTOR)) translate(e);
                e.querySelectorAll(I18N_SELECTOR).forEach(translate);
            }
    }
}).observe(document, {
    attributeFilter: ["data-i18n", "data-i18n-attr", "data-i18n-vars"],
    subtree: true,
});

export default getMessageSafe;
