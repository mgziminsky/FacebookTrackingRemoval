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

import { joinSelectors, normalizeString } from "./util.js";

export {
    click_whitelist,
    defaults,
    domains,
    hide_rules,
    host_patterns,
    initHideRule,
    options,
    param_cleaning,
    reset,
    storage,
    sync,
};

const storage = browser.storage.local;

/** @type {Options} */
const defaults = Object.freeze({
    enabled: true,
    fixLinks: true,
    internalRefs: false,
    inlineVids: false,
    fixVideos: false,
    delPixeled: true,
    delSuggest: true,
    hideMethod: "collapse",
    useStyle: false,
    logging: false,
    modStyle: "outline: 1px dashed rgba(0, 128, 0, 0.5) !important;",
    userRules: "",
    pendingRules: false,
});

const host_patterns = Object.freeze([...new Set(browser.runtime.getManifest().content_scripts.flatMap(cs => cs.matches))]);
const domains = Object.freeze([...new Set(host_patterns.map(m => m.replace(/\W*\*\W?/g, '')))]);

/** @type {Options} */
const _options = Object.seal(await storage.get(defaults));
const options = new Proxy(_options, {
    set(opts, prop, val) {
        if (!opts.hasOwnProperty(prop))
            return false;

        const old = opts[prop];
        opts[prop] = val ?? defaults[prop];

        let apply;
        if (val != null) {
            apply = storage.set.bind(storage, { [prop]: val });
        } else {
            apply = storage.remove.bind(storage, prop);
        }
        apply().catch(() => opts[prop] = old);

        return true;
    },
    deleteProperty(opts, prop) {
        const old = opts[prop];
        opts[prop] = defaults[prop];
        storage.remove(prop).catch(() => opts[prop] = old);
        return false;
    },
});

/**
 * Reset option value(s) to the default
 *
 * @param {void | string | string[] | { [key: string]: any}} key
 * @return {Promise<void>}
 */
function reset(key) {
    let result;
    if (key) {
        result = storage.remove(key).then(() => _options[key] = defaults[key]);
    } else {
        result = storage.remove(Object.keys(defaults)).then(() => Object.assign(_options, defaults));
    }
    return result;
}

/**
 * Update local options with value from storage
 *
 * @param {?string | string[]} key
 */
async function sync(key) {
    const filtered = key
        ? Object.fromEntries([...key].filter(k => k in defaults).map(k => [k, defaults[k]]))
        : defaults;
    Object.assign(_options, await storage.get(filtered));
}

const RULES_KEY = "hide_rules";
const PARAMS_KEY = "param_cleaning";
const WHITELIST_KEY = "click_whitelist";
const [hide_rules, param_cleaning, click_whitelist] = await (async () => {
    const rules = await browser.storage.local.get([RULES_KEY, PARAMS_KEY, WHITELIST_KEY]);

    /** @type {HideRules} */
    const hr = Object.assign({ article_wrapper: "", sponsored: {}, suggested: {}, pending: {} }, rules[RULES_KEY]);
    Object.values(hr).forEach(initHideRule);
    Object.freeze(hr);

    /** @type {ParamCleaning} */
    const pc = Object.assign({ params: [], prefix_patterns: ['$'], values: [] }, rules[PARAMS_KEY]);
    pc.pattern = new RegExp(`^(${pc.prefix_patterns.join('|')})`);
    Object.freeze(pc);

    /** @type {ClickWhitelist} */
    const cw = Object.assign({ elements: [], roles: [], selectors: [] }, rules[WHITELIST_KEY]);
    cw.selector = joinSelectors(cw.selectors.join("\n"));
    Object.freeze(cw);

    return [hr, pc, cw];
})();

/**
 * Converts the texts and patterns of a rule to final format
 * @param {Object} rule
 * @param {string[]?} rule.texts
 * @param {string[]?} rule.patterns
 *
 * @returns {HideRule}
 */
function initHideRule(rule) {
    if (rule.texts)
        rule.texts = rule.texts.reduce((m, t) => m.set(normalizeString(t), t), new Map());

    if (rule.patterns instanceof Array && rule.patterns.length)
        rule.patterns = new RegExp(rule.patterns.join("|"), "iu");
    else
        delete rule.patterns;

    return rule;
}
