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

const ALLOWED_CLICK_ELEMENTS = ["INPUT", "SELECT", "BUTTON"];
const ALLOWED_ROLES = ["BUTTON", "MENUITEM"];
function isAllowedTarget(e) {
    let checkTarget = e.target;

    // Walk through event target and parents until the currentTarget looking for an element that clicks are allowed on
    while (e.currentTarget !== checkTarget) {
        let role = checkTarget.attributes.role;
        if (ALLOWED_CLICK_ELEMENTS.includes(checkTarget.tagName) || checkTarget.classList.contains("FBTR-SAFE") || (role && ALLOWED_ROLES.includes(role.value.toUpperCase())))
            return true;
        checkTarget = checkTarget.parentNode;
    }

    return false;
}

// Meant to be used as a capturing event handler
function restrictEventPropagation(e) {
    if (!isAllowedTarget(e)) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        app.log("Blocked propagation of " + e.type + " to " + e.target);
    }
}

function stopPropagation(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();
    app.log("Blocked propagation of " + e.type + " to " + e.target);
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
    collapsible.classList.add("fbtrCollapsible");
    collapsible.appendChild(content);

    return collapsible;
}

const STRIPPED_PARAMS = ["ref", "ref_type", "fref", "hc_ref", "rc", "source", "placement", "comment_tracking", "__md__", "from"];
function cleanLinkParams(link) {
    try {
        const url = new URL(link, location.origin);
        const cleanParams = new URLSearchParams(url.search);
        STRIPPED_PARAMS.forEach(cleanParams.delete.bind(cleanParams));
        url.search = cleanParams;
        return url.href.substr(url.origin.length);
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