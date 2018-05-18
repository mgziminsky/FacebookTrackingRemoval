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

const app = {};

(function() {
    const opts = {};
    const defaultOpts = {
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
        modStyle: "border: 1px dashed green !important;"
    };

    let inited = false;
    Object.defineProperties(app, {
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
        init: {
            value: () => app.storage.get(defaultOpts).then(o => {
                Object.assign(opts, o);

                if (opts.logging)
                    app.log = console.log.bind(console);

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
                Object.seal(app.options);

                app.log("Initialized Tracking Removal");
                app.log(JSON.stringify(app.options));

                inited = true;
            })
        }
    });
    Object.seal(app);

    Object.defineProperty(app.options, "reset", {
        value: () => {
            app.storage.clear();
            Object.assign(opts, defaultOpts);
        }
    });
}());