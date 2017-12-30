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