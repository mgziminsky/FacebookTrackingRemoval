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
/* global app */

'use strict';

const PROCESSED_CLASS = "FBTR-PROCESSED";

/** @param {Event} e */
function isAllowedTarget(e) {
    const config = app.click_whitelist;
    let checkTarget = e.target;

    // Walk through event target and parents until the currentTarget looking for an element that clicks are allowed on
    while (e.currentTarget.parentNode !== checkTarget) {
        const role = checkTarget.attributes.role;
        if (checkTarget.tagName === "A" && checkTarget.hostname === location.hostname) {
            return true;
        } else if (role && config.roles.includes(role.value.toUpperCase())) {
            return true;
        } else if (config.elements.includes(checkTarget.tagName) || checkTarget.classList.contains("FBTR-SAFE") || checkTarget.matches(config.selector)) {
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
    if (!isAllowedTarget(e)) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        app.log(`Stopped propagation of ${e.type} from ${e.target}`);
    } else {
        app.log(`Allowed propagation of ${e.type} from ${e.target} to ${e.currentTarget}`);
    }
}

/** @param {Event} e */
function stopPropagation(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    app.log(`Stopped propagation of ${e.type} from ${e.target}`);
}

/** @param {HTMLElement} target */
function applyEventBlockers(target) {
    target.addEventListener("mousedown", restrictEventPropagation, true);
    target.addEventListener("focusin", stopPropagation, true);
    target.addEventListener("focus", stopPropagation, true);
    target.addEventListener("click", restrictEventPropagation, true);
    target.addEventListener("mouseup", restrictEventPropagation, true);
    target.addEventListener("focusout", stopPropagation, true);
    target.addEventListener("blur", stopPropagation, true);
}

/** @param {string} s */
function extractQuotedString(s) {
    return s.substring(s.indexOf('"') + 1, s.lastIndexOf('"'));
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
    collapsible.classList.add("fbtrCollapsible");
    collapsible.appendChild(content);

    return collapsible;
}

/** @param {string} link */
function cleanLinkParams(link, base = (location.origin + location.pathname)) {
    try {
        // Don't mess with anchor links
        if (link.startsWith("#"))
            return link;

        const url = new URL(link, base);

        // Nothing to do
        if (url.search.length <= 1)
            return link;

        const cleanParams = new URLSearchParams(url.search);

        const deleteParam = cleanParams.delete.bind(cleanParams);

        const config = app.param_cleaning;
        config.params.forEach(deleteParam);

        // for..of loop stops early if items are removed
        // .keys() doesn't work in FF... https://bugzilla.mozilla.org/show_bug.cgi?id=1414602
        [...cleanParams].map(([key, _]) => key)
            .filter(config.pattern.test.bind(config.pattern))
            .forEach(deleteParam);

        config.values.filter(cleanParams.has.bind(cleanParams)).forEach(k => {
            const v = JSON.parse(cleanParams.get(k));
            config.params.forEach(key => delete v[key]);
            for (const key in v) {
                if (config.pattern.test(key))
                    delete v[key];
            }
            cleanParams.set(k, JSON.stringify(v));
        });

        const origLength = url.search.length;
        url.search = cleanParams;
        return (origLength === url.search.length)
            ? link // No changes, avoid unintended modification
            // If link is the same host, use absolute pathname, otherwise use full URL
            : url.href.substring(url.host === location.host ? location.origin.length : 0);
    } catch (e) {
        return link;
    }
}

/**
 * @param {Element} node
 * @param {string} selector
 */
function selectAllWithBase(node, selector) {
    const nodeMatches = node.matches(selector);

    const childResults = [];
    for (let c of node.querySelectorAll(selector)) {
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

/** @param {string} text */
function splitLines(text) {
    return text.trim().split(/\s*$\s*/m);
}

/** @param {string} text */
function stripComments(text) {
    return text.replace(/\/\*.*?\*\//g, "").trim();
}

/** @param {string} text */
function joinSelectors(text) {
    return stripComments(text).replace(/\s*$\s/gm, ",").replace(/\s+/g, " ");
}

function parseHideRules(text) {
    const selector = new Set;
    const texts = new Set;
    const patterns = new Set;

    for (let line of splitLines(stripComments(text))) {
        const [sel, ...filters] = line.split("||");

        sel.trim().replaceAll(/\s+/g, " ").split(",").forEach(selector.add.bind(selector));

        for (const val of filters) {
            if (/^\/.*[^\\](?:\\\\)*\/$/.test(val))
                patterns.add(val.substring(1, val.length - 1));
            else
                texts.add(val.toLowerCase());
        }
    }

    return {
        selector: Array.from(selector).join(","),
        texts: Array.from(texts).sort(),
        patterns: Array.from(patterns).sort(),
    };
}

/** @param {string} str */
function normalizeString(str) {
    return Array.from(str.trim().toLowerCase()).sort().join("");
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
