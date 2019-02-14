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

const app = {};

(function() {
    // Adapted from https://stackoverflow.com/a/51086893
    class Mutex {
        constructor() {
            this.current = Promise.resolve();
            this._locks = [];
        }

        lock() {
            let _resolve;
            const p = new Promise(resolve => {
                _resolve = () => resolve();
            });
            // Caller gets a promise that resolves when the current outstanding lock resolves
            const rv = this.current.then(() => _resolve);
            // Don't allow the next request until the new promise is done
            this.current = p;
            // Return the new promise
            this._locks.push(rv);
            return rv;
        };

        release() {
            this._locks.shift()();
        }
    }

    const RULES_KEY = "hide_rules";
    const PARAMS_KEY = "param_cleaning";
    const WHITELIST_KEY = "click_whitelist";

    const opts = {};

    let inited = false;
    const initMutex = new Mutex();

    Object.defineProperties(app, {
        defaults: {
            value: Object.freeze({
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
                modStyle: "border: 1px dashed green !important;",
                userRules: "",
                pendingRules: false,
            }),
            enumerable: true
        },
        options: {
            value: {},
            enumerable: true
        },
        storage: {
            value: browser.storage.local,
            enumerable: true
        },
        log: {
            value: () => {},
            writable: true
        },
        host_patterns: {
            value: Object.freeze([...new Set([].concat(...browser.runtime.getManifest().content_scripts.map(cs => cs.matches)))]),
            enumerable: true
        },
        domains: {
            value: Object.freeze([...new Set([].concat(...browser.runtime.getManifest().content_scripts.map(cs => cs.matches.map(m => m.replace(/\W*\*\W?/g, '')))))]),
            enumerable: true
        },
        reloadTabs: {
            value: () => browser.tabs.query({url: app.host_patterns, windowType: "normal"}).then(tabs => tabs.forEach(t => browser.tabs.reload(t.id))),
            enumerable: false
        },
        [RULES_KEY]: {
            value: Object.seal({
                suggestions: "",
                sponsored: "",
                pending: "",
                content: {},
                content_pending: {},
            }),
            enumerable: true
        },
        [PARAMS_KEY]: {
            value: Object.seal({
                params: [],
                pattern: /^$/,
                values: [],
            }),
            enumerable: true
        },
        [WHITELIST_KEY]: {
            value: Object.seal({
                elements: [],
                roles: [],
                selector: "",
            }),
            enumerable: true
        },
        init: {
            value: () => {
                const lock = initMutex.lock();
                return app.storage.get(app.defaults).then(async o => {
                    await lock;
                    Object.assign(opts, o);

                    if (opts.logging)
                        app.log = console.log.bind(console);
                    else
                        app.log = () => {};

                    if (inited) return;

                    for (let key in opts) {
                        Object.defineProperty(app.options, key, {
                            get: () => opts[key],
                            set: val => {
                                const old = opts[key];
                                opts[key] = val;
                                app.storage.set({[key]: val}).catch(() => opts[key] = old);
                            },
                            enumerable: true
                        });
                    }
                    Object.defineProperty(app.options, "reset", {
                        value: key => {
                            let result;
                            if (key) {
                                result = app.storage.remove(key).then(() => opts[key] = app.defaults[key]);
                            } else {
                                result = app.storage.remove(Object.keys(app.defaults)).then(() => Object.assign(opts, app.defaults));
                            }
                            return result;
                        },
                        enumerable: false,
                    });
                    Object.freeze(app.options);

                    await loadHideRules();
                    await loadParamCleaning();
                    await loadClickWhitelist();

                    app.log("Initialized Tracking Removal");
                    app.log(JSON.stringify(app.options));

                    inited = true;
                })
                .catch(e => {
                    inited = false;
                    return Promise.reject(e);
                })
                .finally(() => lock.then(release => release()));
            }
        }
    });
    Object.seal(app);

    async function loadHideRules() {
        const hr = app[RULES_KEY];
        ({
            [RULES_KEY]: {
                suggestions: {
                    value: hr.suggestions = hr.suggestions
                } = {},
                sponsored: {
                    value: hr.sponsored = hr.sponsored
                } = {},
                pending: {
                    value: hr.pending = hr.pending
                } = {},
                content: {
                    value: hr.content = hr.content
                } = {},
                content_pending: {
                    value: hr.content_pending = hr.content_pending
                } = {},
            } = {},
        } = await browser.storage.local.get(RULES_KEY));
        Object.freeze(hr);
    }

    async function loadParamCleaning() {
        const pc = app[PARAMS_KEY];
        let _patterns;
        ({
            [PARAMS_KEY]: {
                params: {
                    value: pc.params = pc.params
                } = {},
                prefix_patterns: {
                    value: _patterns = ['$']
                } = {},
                values: {
                    value: pc.values = pc.values
                } = {},
            } = {},
        } = await browser.storage.local.get(PARAMS_KEY));
        pc.pattern = new RegExp(`^(${_patterns.join('|')})`);
        Object.freeze(pc);
    }

    async function loadClickWhitelist() {
        const cw = app[WHITELIST_KEY];
        let _selectors;
        ({
            [WHITELIST_KEY]: {
                elements: {
                    value: cw.elements = cw.elements
                } = {},
                roles: {
                    value: cw.roles = cw.roles
                } = {},
                selectors: {
                    value: _selectors = []
                } = {},
            } = {},
        } = await browser.storage.local.get(WHITELIST_KEY));
        cw.selector = joinSelectors(_selectors.join("\n"));
        Object.freeze(cw);
    }
}());
