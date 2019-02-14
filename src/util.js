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

    Copyright (C) 2016-2019 Michael Ziminsky
*/

'use strict';

const PROCESSED_CLASS = "FBTR-PROCESSED";

function isAllowedTarget(e) {
    const config = app.click_whitelist;
    let checkTarget = e.target;

    // Walk through event target and parents until the currentTarget looking for an element that clicks are allowed on
    while (e.currentTarget.parentNode !== checkTarget) {
        const role = checkTarget.attributes.role;
        if (checkTarget.tagName === "A" && (!checkTarget.hasAttribute("href") || checkTarget.getAttribute("href") === "#")) {
            e.preventDefault();
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

// Meant to be used as a capturing event handler
function restrictEventPropagation(e) {
    if (!isAllowedTarget(e)) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        app.log(`Stopped propagation of ${e.type} from ${e.target}`);
    } else {
        app.log(`Allowed propagation of ${e.type} from ${e.target} to ${e.currentTarget}`);
    }
}

function stopPropagation(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    app.log(`Stopped propagation of ${e.type} from ${e.target}`);
}

function applyEventBlockers(target) {
    target.addEventListener("mousedown", stopPropagation, true);
    target.addEventListener("focusin", stopPropagation, true);
    target.addEventListener("focus", stopPropagation, true);
    target.addEventListener("click", restrictEventPropagation, true);
    target.addEventListener("mouseup", stopPropagation, true);
    target.addEventListener("focusout", stopPropagation, true);
    target.addEventListener("blur", stopPropagation, true);
}

function extractQuotedString(s) {
    return s.substring(s.indexOf('"') + 1, s.lastIndexOf('"'));
}

function cleanAttrs(elem) {
    for (let i = elem.attributes.length - 1; i >= 0; --i) {
        const attr = elem.attributes[i];
        if (attr.name !== 'class' && !attr.name.startsWith('aria-'))
            elem.removeAttribute(attr.name);
    }
}

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

function cleanLinkParams(link) {
    // Don't mess with anchor links
    if (link.startsWith("#"))
        return link;

    try {
        const url = new URL(link, location.href);

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
            : url.href.substr(location.origin.length);
    } catch (e) {
        return link;
    }
}

function selectAllWithBase(node, selector) {
    const childResults = node.querySelectorAll(selector);
    const nodeMatches = node.matches(selector);
    const results = (function*() {
        if (nodeMatches) yield node;
        yield* childResults;
    })();
    results.length = childResults.length + nodeMatches;
    return results;
}

function splitLines(text) {
    return text.trim().split(/\s*$\s*/m);
}

function stripComments(text) {
    return text.trim().replace(/\s*\/\*.*?\*\//g, "");
}

function joinSelectors(text) {
    return stripComments(text).replace(/\s*$\s/gm, ",").replace(/\s+/g, " ");
}

function normalizeString(str) {
    return Array.from(new Set(str.trim().toLowerCase())).sort().join("");
}
