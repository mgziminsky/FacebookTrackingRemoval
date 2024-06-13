/**
 * Copyright (C) 2023 Michael Ziminsky (Z)
 *
 * This file is part of FacebookTrackingRemoval.
 *
 * FacebookTrackingRemoval is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * FacebookTrackingRemoval is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with FacebookTrackingRemoval.  If not, see <http://www.gnu.org/licenses/>.
 */

import { log } from "../common.js";
import { click_whitelist } from "../config.js";
import { COLLAPSED_SELECTOR, PROCESSED_CLASS } from "../consts.js";

export {
    applyEventBlockers,
    ariaText,
    buildCollapsible,
    cleanAttrs,
    inlineUse,
    selectAllWithBase,
    stopPropagation,
    visibleText,
};


/** @param {Event} e */
function isAllowedTarget(e) {
    let checkTarget = e.target;

    // Walk through event target and parents until the currentTarget looking for an element that clicks are allowed on
    while (e.currentTarget.parentNode !== checkTarget) {
        const role = checkTarget.attributes.role;
        if (checkTarget.tagName === "A" && checkTarget.hostname === location.hostname) {
            return true;
        }
        if (role && click_whitelist.roles.includes(role.value.toUpperCase())) {
            return true;
        }
        if (click_whitelist.elements.includes(checkTarget.tagName) || checkTarget.classList.contains("FBTR-SAFE") || checkTarget.matches(click_whitelist.selector)) {
            return true;
        }
        checkTarget = checkTarget.parentNode;
    }

    return false;
}

/**
 * Meant to be used as a capturing event handler
 * @param {Event} e
*/
function restrictEventPropagation(e) {
    if (isAllowedTarget(e)) {
        log(`Allowed propagation of ${e.type} from ${e.target} to ${e.currentTarget}`);
    } else {
        stopPropagation(e);
    }
}

/** @param {Event} e */
function stopPropagation(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    log(`Stopped propagation of ${e.type} from ${e.target}`);
}

/** @param {HTMLElement} target */
function applyEventBlockers(target) {
    target.addEventListener("mousedown", restrictEventPropagation, true);
    target.addEventListener("focusin", stopPropagation, true);
    target.addEventListener("focus", restrictEventPropagation, true);
    target.addEventListener("click", restrictEventPropagation, true);
    target.addEventListener("mouseup", restrictEventPropagation, true);
    target.addEventListener("focusout", stopPropagation, true);
    target.addEventListener("blur", stopPropagation, true);
}

/** @param {Element} elem */
function cleanAttrs(elem) {
    for (let i = elem.attributes.length - 1; i >= 0; --i) {
        const attr = elem.attributes[i];
        if (attr.name !== 'class' && !attr.name.startsWith('aria-'))
            elem.removeAttribute(attr.name);
    }
}

/** @param {string} label */
function buildCollapsible(label) {
    const content = document.createElement("summary");
    content.textContent = label;
    content.classList.add("fbtrLabel");

    const collapsible = document.createElement("details");
    collapsible.classList.add(PROCESSED_CLASS);
    collapsible.classList.add(COLLAPSED_SELECTOR.substring(1));
    collapsible.appendChild(content);

    return collapsible;
}

/**
 * @param {Element} node
 * @param {string} selector
 */
function selectAllWithBase(node, selector) {
    const nodeMatches = !node.classList.contains(PROCESSED_CLASS) && node.matches(selector);

    const childResults = [];
    for (const c of node.querySelectorAll(selector)) {
        if (!c.classList.contains(PROCESSED_CLASS))
            childResults.push(c);
    }

    const results = (function* () {
        if (nodeMatches) yield node;
        yield* childResults;
    })();
    results.length = childResults.length + nodeMatches;
    return results;
}

/**
 * Replace all `use` elements with a copy of their referenced content.
 * @param {Element} target
 */
function inlineUse(target) {
    for (const use of selectAllWithBase(target, "use")) {
        const used = document.querySelector(use.href.baseVal)?.cloneNode(true);
        if (used) {
            used.removeAttribute("id");
            use.replaceWith(used);
        }
    }
}

/** @param {HTMLElement} elem */
function ariaText(elem) {
    const labels = elem.getAttribute('aria-labelledby')?.split(' ')
        .map(id => document.getElementById(id))
        .filter(e => e);

    const text = [...new Set(labels || [])].map(e => e.textContent).join(' ');
    return text ? text : elem.getAttribute('aria-label');
}

/** @param {HTMLElement} elem */
function visibleText(elem) {
    let text = elem.dataset.content ?? "";
    const bounds = elem.getBoundingClientRect();
    const children = [...elem.childNodes].reverse();

    while (children.length > 0) {
        const child = children.pop();
        switch (child.nodeType) {
            case Node.TEXT_NODE:
                text += child.nodeValue;
                break;
            case Node.ELEMENT_NODE: {
                if (!rectsIntersect(bounds, child.getBoundingClientRect()))
                    continue;
                text += child.dataset.content ?? "";
                for (let c = child.lastChild; c !== null; c = c.previousSibling)
                    children.push(c);
                break;
            }
        }
    }

    return text;
}

/**
 * @param {DOMRect} a
 * @param {DOMRect} b
 */
function rectsIntersect(a, b) {
    return a.top < b.bottom
        && a.right > b.left
        && a.bottom > b.top
        && a.left < b.right
        ;
}
