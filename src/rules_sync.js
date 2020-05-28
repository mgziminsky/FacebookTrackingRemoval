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

const STATIC_RULE_FILES = ["suggestions", "sponsored", "pending", "article_wrapper"];
const DYN_RULE_FILES = ["content", "content_pending"];
const PARAM_CLEANING_FILES = ["params", "prefix_patterns", "values"];
const CLICK_WHITELIST_FILES = ["elements", "roles", "selectors"];

const DATE_HEADER = "last-modified";
const RATE_LIMIT = (1000 * 60 * 5); // 5 min

function shouldSkip(newDateString, oldDateString) {
    const newDate = Date.parse(newDateString);
    const oldDate = Date.parse(oldDateString);

    // New value failed lookup, don't replace cached value
    if (isNaN(newDate) && !isNaN(oldDate))
        return true;

    // Failed to get new value, but nothing cached, use fallback
    if (isNaN(newDate) && isNaN(oldDate))
        return false;

    // Lookup succeeded, no cache, use new.
    if (!isNaN(newDate) && isNaN(oldDate))
        return false;

    // Skip unless new value is more recent than old
    return newDate <= oldDate;
}

async function loadHideRules(fetchRule) {
    const { hide_rules: currentRules = {} } = await browser.storage.local.get("hide_rules");

    const newRules = {};
    for (let file of STATIC_RULE_FILES) {
        const resp = await fetchRule(`hide_rules/${file}`, currentRules[file]);

        if (resp === null)
            continue;

        const value = await resp.text().then(joinSelectors);
        if (!value)
            continue;

        newRules[file] = {
            value,
            [DATE_HEADER]: resp.headers.get(DATE_HEADER),
        };
    }

    for (let file of DYN_RULE_FILES) {
        const resp = await fetchRule(`hide_rules/${file}`, currentRules[file]);

        if (resp === null)
            continue;

        const rules = {};
        const lines = await resp.text().then(stripComments).then(splitLines);
        let empty = true;
        for (let line of lines) {
            const [sel, ...filters] = line.split("||");

            if (filters.length < 1)
                continue;

            const cleanSel = sel.trim().replace(/\s+/, "");
            if (!rules.hasOwnProperty(cleanSel))
                rules[cleanSel] = new Set();

            filters.map(normalizeString).forEach(rules[cleanSel].add.bind(rules[cleanSel]));
            empty = false;
        }

        if (empty)
            continue;

        for (let k in rules)
            rules[k] = Array.from(rules[k]); // Convert Set to Arrray. Sets not supported by storage api

        newRules[file] = {
            value: rules,
            [DATE_HEADER]: resp.headers.get(DATE_HEADER),
        };
    }

    return Object.assign(currentRules, newRules);
}

async function loadArrayData(fetchFunc, key, files) {
    const { [key]: currentRules = {} } = await browser.storage.local.get(key);

    const newRules = {};
    for (let file of files) {
        const resp = await fetchFunc(`${key}/${file}`, currentRules[file]);

        if (resp === null)
            continue;

        newRules[file] = {
            value: await resp.text().then(stripComments).then(splitLines),
            [DATE_HEADER]: resp.headers.get(DATE_HEADER),
        };
    }

    return Object.assign(currentRules, newRules);
}

async function refreshRules({ force = false, check = false } = {}) {
    const devMode = (await browser.management.getSelf()).installType === "development";
    const { lastRuleRefresh: lastRefresh } = await browser.storage.local.get("lastRuleRefresh");

    // Prevent abuse, max refresh once per 5 min
    const timeout = devMode ? 0 : RATE_LIMIT - (Date.now() - Date.parse(lastRefresh));

    if (check)
        return Promise.resolve(timeout > 0 ? timeout : 0);

    if (timeout > 0)
        return Promise.reject(timeout);

    const fetchRule = async (path, current) => {
        const resp = await fetch(`https://${devMode ? "localhost" : "mgziminsky.gitlab.io"}/FacebookTrackingRemoval/${path}`, { mode: 'cors' })
            .then(resp => resp.ok ? resp : Promise.reject())
            .catch(_ => current
                ? new Response(current, { status: 418 }) // keep saved value if present
                : fetch(browser.runtime.getURL(`src/${path}`)) // Fallback to bundled copy as last resort, should never fail if file is present
            )
            .catch(err => new Response(err, { status: 500 })); // Final fallback in case of any other error

        if (!resp.ok || !force && shouldSkip(resp.headers.get(DATE_HEADER), (current || {})[DATE_HEADER]))
            return null; // No updates, or no file

        return resp;
    };

    browser.storage.local.set({
        hide_rules: await loadHideRules(fetchRule),
        param_cleaning: await loadArrayData(fetchRule, "param_cleaning", PARAM_CLEANING_FILES),
        click_whitelist: await loadArrayData(fetchRule, "click_whitelist", CLICK_WHITELIST_FILES),
        lastRuleRefresh: new Date().toUTCString(),
    }).then(() => RATE_LIMIT);
}
