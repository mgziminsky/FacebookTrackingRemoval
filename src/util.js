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

const PROCESSED_CLASS = "FBTR-PROCESSED";

const ALLOWED_CLICK_ELEMENTS = ["INPUT", "SELECT", "BUTTON", "TEXTAREA"];
const ALLOWED_ROLES = ["BUTTON"];
const ALLOWED_SELECTOR = [
    "a[data-jsid='actionLink']", "a[ajaxify]", "a.see_more_link", "form div.pam", // Desktop
    "span[data-sigil='more']", // Mobile
].join(",");

function isAllowedTarget(e) {
    let checkTarget = e.target;
    let allow = false;

    // Walk through event target and parents until the currentTarget looking for an element that clicks are allowed on
    while (e.currentTarget.parentNode !== checkTarget) {
        const role = checkTarget.attributes.role;
        if (role && ALLOWED_ROLES.includes(role.value.toUpperCase())) {
            allow = true;
        } else if (checkTarget.tagName === "A" && checkTarget.getAttribute("href") == "#") {
            allow = true;
        } else if (ALLOWED_CLICK_ELEMENTS.includes(checkTarget.tagName) || checkTarget.classList.contains("FBTR-SAFE") || checkTarget.matches(ALLOWED_SELECTOR)) {
            allow = true;
        }
        if (allow) break;
        checkTarget = checkTarget.parentNode;
    }

    // prevent navigation on special links
    if (allow && checkTarget.tagName === "A")
        e.preventDefault();

    return allow;
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
    collapsible.classList.add(PROCESSED_CLASS);
    collapsible.classList.add("fbtrCollapsible");
    collapsible.appendChild(content);

    return collapsible;
}

const STRIPPED_PARAMS = ["ref", "ref_type", "fref", "rc", "placement", "comment_tracking", "from", "referrer"];
const STRIP_PATTERN = /^(((\w*_)?source|hc)(\b|_)|ft\[|__)/;
const CLEANED_VALUES = ["extragetparams", "acontext"];
function cleanLinkParams(link) {
    try {
        const url = new URL(link, location.href);

        // Nothing to do
        if (url.search.length <= 1)
            return link;

        const cleanParams = new URLSearchParams(url.search);

        const deleteParam = cleanParams.delete.bind(cleanParams);
        STRIPPED_PARAMS.forEach(deleteParam);

        // for..of loop stops early if items are removed
        // .keys() doesn't work in FF... https://bugzilla.mozilla.org/show_bug.cgi?id=1414602
        [...cleanParams].map(([key, _]) => key)
            .filter(STRIP_PATTERN.test.bind(STRIP_PATTERN))
            .forEach(deleteParam);

        CLEANED_VALUES.filter(cleanParams.has.bind(cleanParams)).forEach(k => {
            const v = JSON.parse(cleanParams.get(k));
            STRIPPED_PARAMS.forEach(key => delete v[key]);
            for (const key in v) {
                if (STRIP_PATTERN.test(key))
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
