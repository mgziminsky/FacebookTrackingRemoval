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

    Copyright (C) 2016-2023 Michael Ziminsky
*/

import { NOOP, RATE_LIMIT } from "./consts.js";
import { joinSelectors, parseHideRules, splitLines, stripComments } from "./util.js";

export { refreshRules, timeoutRemaining };

const SELECTOR_RULE_FILES = ["article_wrapper", "unconditional"];
const DYN_RULE_FILES = ["pending"];
const SPLIT_RULE_DIRS = ["sponsored", "suggested"];
const PARAM_CLEANING_FILES = ["params", "prefix_patterns", "values"];
const CLICK_WHITELIST_FILES = ["elements", "roles", "selectors"];

async function fetchRule(path, currentVal) {
    const devMode = (await browser.management.getSelf()).installType === "development";
    return fetch(`https://${devMode ? "localhost" : "mgziminsky.gitlab.io"}/FacebookTrackingRemoval/${path}`, {
        mode: "cors",
        signal: devMode ? AbortSignal.timeout(100) : undefined,
    })
        .then(resp => (resp.ok ? resp : Promise.reject()))
        .catch(() =>
            currentVal
                ? Promise.reject(`Keeping current value: ${currentVal}`)
                : fetch(browser.runtime.getURL(`data/${path}`)),
        ) // Fallback to bundled copy
        .then(resp => (resp.ok ? resp.text() : Promise.reject()));
}

async function loadHideRules() {
    const { hide_rules: currentRules = {} } = await browser.storage.local.get("hide_rules");
    const newRules = {};

    for (const file of SELECTOR_RULE_FILES) {
        await fetchRule(`hide_rules/${file}`, currentRules[file])
            .then(joinSelectors)
            .then(sel => (newRules[file] = sel))
            .catch(e => console.warn(`Failed to load selectors file "${file}"\n\t`, e));
    }

    for (const file of DYN_RULE_FILES) {
        await fetchRule(`hide_rules/${file}`, currentRules[file])
            .then(parseHideRules)
            .then(rule => Object.assign((newRules[file] ??= {}), rule))
            .catch(e => console.warn(`Failed to load legacy rules from "${file}"\n\t`, e));
    }

    for (const dir of SPLIT_RULE_DIRS) {
        await loadSplitRule(dir, currentRules[dir])
            .then(rule => Object.assign((newRules[dir] ??= {}), rule))
            .catch(e => console.warn(`Split rule "${dir}" failed to load\n\t`, e));
    }

    return Object.assign(currentRules, newRules);
}

async function loadArrayData(key, files) {
    const { [key]: currentRules = {} } = await browser.storage.local.get(key);

    const newRules = {};
    for (const file of files) {
        await fetchRule(`${key}/${file}`, currentRules[file])
            .then(stripComments)
            .then(splitLines)
            .then(data => (newRules[file] = data))
            .catch(e => console.warn(`Failed to load array data from "${key}/${file}"\n\t`, e));
    }

    return Object.assign(currentRules, newRules);
}

/** @param {HideRule} currentRule */
async function loadSplitRule(dir, currentRule) {
    const rule = {};

    rule.selector = await fetchRule(`hide_rules/${dir}/selectors`, currentRule?.selector)
        .then(joinSelectors)
        .catch(e => console.warn(`Failed to load selectors for "${dir}"\n\t`, e));

    // Selector required, fail if missing or empty
    if (!rule.selector) return Promise.reject("Selector missing or empty");

    await fetchRule(`hide_rules/${dir}/texts`, currentRule?.texts)
        .then(stripComments)
        .then(splitLines)
        .then(a => a.sort())
        .then(texts => (rule.texts = texts))
        .catch(e => console.warn(`Failed to load texts for "${dir}"\n\t`, e));

    await fetchRule(`hide_rules/${dir}/patterns`, currentRule?.patterns)
        .then(stripComments)
        .then(splitLines)
        .then(a => a.sort())
        .then(patterns => (rule.patterns = patterns))
        .catch(e => console.warn(`Failed to load patterns for "${dir}"\n\t`, e));

    return rule;
}

/** @param {Function} func */
async function _try(func, ...args) {
    try {
        return await func(...args);
    } catch (error) {
        console.warn(error);
    }
}

async function timeoutRemaining() {
    const { lastRuleRefresh } = await browser.storage.local.get("lastRuleRefresh");
    const timeout = !lastRuleRefresh ? 0 : RATE_LIMIT - (Date.now() - Date.parse(lastRuleRefresh));
    return Math.max(0, timeout);
}

async function refreshRules(force = false) {
    const timeout = force ? 0 : await timeoutRemaining();

    if (timeout > 0) return Promise.reject(timeout);

    browser.storage.local
        .set({
            hide_rules: await _try(loadHideRules),
            param_cleaning: await _try(loadArrayData, "param_cleaning", PARAM_CLEANING_FILES),
            click_whitelist: await _try(loadArrayData, "click_whitelist", CLICK_WHITELIST_FILES),
            lastRuleRefresh: new Date().toUTCString(),
        })
        .then(() => RATE_LIMIT);
}

// refresh rules every 12 hours
browser.alarms.onAlarm.addListener(() => refreshRules().catch(NOOP));
browser.alarms.create({ when: Date.now(), periodInMinutes: 60 * 12 });
