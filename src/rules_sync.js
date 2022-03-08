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
/* global joinSelectors, parseHideRules, stripComments, splitLines */

'use strict';

const STATIC_RULE_FILES = ["article_wrapper"];
const DYN_RULE_FILES = ["content", "content_pending", "suggestions_smart"];
const PARAM_CLEANING_FILES = ["params", "prefix_patterns", "values"];
const CLICK_WHITELIST_FILES = ["elements", "roles", "selectors"];

const DATE_HEADER = "last-modified";
const RATE_LIMIT = (1000 * 60 * 15); // 15 min

async function loadHideRules() {
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

        const rules = parseHideRules(await resp.text());

        if (Object.keys(rules).length == 0)
            continue;

        newRules[file] = {
            value: rules,
            [DATE_HEADER]: resp.headers.get(DATE_HEADER),
        };
    }

    return Object.assign(currentRules, newRules);
}

async function loadArrayData(key, files) {
    const { [key]: currentRules = {} } = await browser.storage.local.get(key);

    const newRules = {};
    for (let file of files) {
        const resp = await fetchRule(`${key}/${file}`, currentRules[file]);

        if (resp === null)
            continue;

        newRules[file] = {
            value: await resp.text().then(stripComments).then(splitLines),
            [DATE_HEADER]: resp.headers.get(DATE_HEADER),
        };
    }

    return Object.assign(currentRules, newRules);
}

async function fetchRule(path, current) {
    const devMode = (await browser.management.getSelf()).installType === "development";

    const resp = await fetch(`https://${devMode ? "localhost" : "mgziminsky.gitlab.io"}/FacebookTrackingRemoval/${path}`, { mode: 'cors' })
        .then(resp => resp.ok ? resp : Promise.reject())
        .catch(_ => current
            ? new Response(current, { status: 418 }) // keep saved value if present
            : fetch(browser.runtime.getURL(`src/${path}`)) // Fallback to bundled copy as last resort, should never fail if file is present
        )
        .catch(err => new Response(err, { status: 500 })); // Final fallback in case of any other error

    if (!resp.ok)
        return null; // No updates, or no file

    return resp;
}

/* exported refreshRules */
async function refreshRules({ force = false, check = false } = {}) {
    const { lastRuleRefresh: lastRefresh } = await browser.storage.local.get("lastRuleRefresh");

    // Prevent abuse, max refresh once per 15 min
    const timeout = force || !lastRefresh ? 0 : RATE_LIMIT - (Date.now() - Date.parse(lastRefresh));

    if (check)
        return Promise.resolve(Math.max(0, timeout));

    if (timeout > 0)
        return Promise.reject(timeout);

    browser.storage.local.set({
        hide_rules: await loadHideRules(),
        param_cleaning: await loadArrayData("param_cleaning", PARAM_CLEANING_FILES),
        click_whitelist: await loadArrayData("click_whitelist", CLICK_WHITELIST_FILES),
        lastRuleRefresh: new Date().toUTCString(),
    }).then(() => RATE_LIMIT);
}
