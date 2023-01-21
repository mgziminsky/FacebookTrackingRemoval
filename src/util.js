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

    Copyright (C) 2016-2022 Michael Ziminsky
*/

import { param_cleaning } from "./config.js";

export {
    cleanLinkParams,
    joinSelectors,
    normalizeString,
    parseHideRules,
    splitLines,
    stripComments,
};


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

    for (const line of splitLines(stripComments(text))) {
        const [sel, ...filters] = line.split("||");

        sel.trim().replaceAll(/\s+/g, " ").split(",").forEach(selector.add.bind(selector));

        for (const val of filters) {
            if (/^\/.*[^\\](?:\\\\)*\/$/.test(val))
                patterns.add(val.substring(1, val.length - 1));
            else
                texts.add(val);
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

        const pc = param_cleaning;
        pc.params.forEach(deleteParam);

        // for..of loop stops early if items are removed
        // .keys() doesn't work in FF... https://bugzilla.mozilla.org/show_bug.cgi?id=1414602
        [...cleanParams].map(([key, _]) => key)
            .filter(pc.pattern.test.bind(pc.pattern))
            .forEach(deleteParam);

        pc.values.filter(cleanParams.has.bind(cleanParams)).forEach(k => {
            const v = JSON.parse(cleanParams.get(k));
            pc.params.forEach(key => delete v[key]);
            for (const key in v) {
                if (pc.pattern.test(key))
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
