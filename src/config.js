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
    onChanged,
    options,
    param_cleaning,
    reset,
    storage,
    READY,
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

const host_patterns = Object.freeze([
    ...new Set(browser.runtime.getManifest().content_scripts.flatMap(cs => cs.matches)),
]);
const domains = Object.freeze([...new Set(host_patterns.map(m => m.replace(/\W*\*\W?/g, "")))]);

/** @type {Options} */
const _options = Object.seal(Object.assign({}, defaults));
const options = new Proxy(_options, {
    set(opts, prop, val) {
        if (!Object.hasOwn(opts, prop)) return false;

        const old = opts[prop];
        opts[prop] = val ?? defaults[prop];

        let apply;
        if (val != null) {
            apply = storage.set.bind(storage, { [prop]: val });
        } else {
            apply = storage.remove.bind(storage, prop);
        }
        apply().catch(() => (opts[prop] = old));

        return true;
    },
    deleteProperty(opts, prop) {
        const old = opts[prop];
        opts[prop] = defaults[prop];
        storage.remove(prop).catch(() => (opts[prop] = old));
        return false;
    },
});

/**
 * Reset option value(s) to the default
 *
 * @param {?string | string[]} keys
 * @return {Promise<void>}
 */
function reset(keys) {
    let result;
    if (keys) {
        result = storage.remove(keys).then(() => {
            for (const key of [...keys]) _options[key] = defaults[key];
        });
    } else {
        result = storage.remove(Object.keys(defaults)).then(() => Object.assign(_options, defaults));
    }
    return result;
}

const _data = Object.freeze({
    hide_rules: Object.freeze({
        /**@type {HideRules}*/
        value: { article_wrapper: "", pending: {}, sponsored: {}, suggested: {}, unconditional: "" },
        update(/**@type {HideRules}*/ raw) {
            Object.assign(this.value, raw);
            Object.values(this.value).forEach(initHideRule);
        },
    }),
    param_cleaning: Object.freeze({
        /**@type {ParamCleaning}*/
        value: { params: [], prefix_patterns: ["$"], values: [] },
        update(/**@type {ParamCleaning}*/ raw) {
            Object.assign(this.value, raw);
            this.value.pattern = new RegExp(`^(${this.value.prefix_patterns.join("|")})`);
        },
    }),
    click_whitelist: Object.freeze({
        /**@type {ClickWhitelist}*/
        value: { elements: [], roles: [], selectors: [] },
        update(/**@type {ClickWhitelist}*/ raw) {
            Object.assign(this.value, raw);
            this.value.selector = joinSelectors(this.value.selectors.join("\n"));
        },
    }),
});

/** @type {ProxyHandler} */
const ReadOnly = {
    set: () => false,
    isExtensible: () => false,
    defineProperty: () => {
        throw new Error("Not Allowed");
    },
    deleteProperty: () => {
        throw new Error("Not Allowed");
    },
};
const [hide_rules, param_cleaning, click_whitelist] = [
    new Proxy(_data.hide_rules.value, ReadOnly),
    new Proxy(_data.param_cleaning.value, ReadOnly),
    new Proxy(_data.click_whitelist.value, ReadOnly),
];

/**
 * Converts the texts and patterns of a rule to final format
 * @param {Object} rule
 * @param {string[]?} rule.texts
 * @param {string[]?} rule.patterns
 *
 * @returns {HideRule}
 */
function initHideRule(rule) {
    if (rule.texts) rule.texts = rule.texts.reduce((m, t) => m.set(normalizeString(t), t), new Map());

    if (Array.isArray(rule.patterns) && rule.patterns.length) rule.patterns = new RegExp(rule.patterns.join("|"), "iu");
    // biome-ignore lint/performance/noDelete:
    else delete rule.patterns;

    return rule;
}

const _onChanged = new Set();
/** @type {WebExtEvent<(changes: { [key: string]: browser.storage.StorageChange }) => void>} */
const onChanged = Object.freeze({
    addListener(cb) {
        if (typeof cb === "function") _onChanged.add(cb);
    },
    removeListener: _onChanged.delete.bind(_onChanged),
    hasListener: _onChanged.has.bind(_onChanged),
});

/**
 * Update local options with value from storage
 *
 * @param {string | string[]} keys
 */
async function sync(keys) {
    const { opts, rules } = [...keys].reduce(
        (acc, key) => {
            if (key in defaults) acc.opts[key] = defaults[key];
            else if (key in _data) acc.rules[key] = _data[key].value;
            return acc;
        },
        { opts: {}, rules: {} },
    );

    const result = [];
    if (Object.keys(opts).length) result.push(storage.get(opts).then(opts => Object.assign(_options, opts)));

    if (Object.keys(rules).length)
        result.push(
            storage.get(rules).then(rules => {
                for (const k in rules) _data[k].update(rules[k]);
            }),
        );

    return Promise.allSettled(result);
}
storage.onChanged.addListener(changes => {
    sync(Object.keys(changes)).then(() => {
        for (const k of Object.keys(_data)) delete changes[k];

        if (Object.keys(changes).length) for (const cb of _onChanged.values()) cb(changes);
    });
});

const READY = new Promise((res, rej) => {
    Promise.all([
        storage.get(defaults).then(vals => Object.assign(_options, vals)),
        browser.storage.local.get(Object.keys(_data)).then(data => {
            for (const k in data) _data[k].update(data[k]);
        }),
    ]).then(() => res(), rej);
});
