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

// Do some cleanup after updating to 1.6.4+ for the first time
// to get rid of old storage data that is no longer used
browser.runtime.onInstalled.addListener(details => {
    // Not an update
    if (!details.previousVersion)
        return;

    let p = Promise.resolve();
    const newVersion = browser.runtime.getManifest().version;

    // 1.8.0 changed the dynamic rules format
    if (details.previousVersion < '1.8.0' && newVersion >= '1.8.0')
        p = p.then(refreshRules.bind({ force: true }));

    if (details.previousVersion <= "1.6.3")
        p = p.then(app.init).then(async () => {
            const currentOpts = await app.storage.get(Object.keys(app.defaults));
            app.storage.clear();
            browser.storage.local.clear();
            app.storage.set(currentOpts);
            browser.runtime.reload();
        });
});

refreshRules();
setInterval(refreshRules, 1000 * 60 * 60 * 12); // refresh every 12 hours

/*
    Keep track of open options and FB windows and the currently
    active options. When an options window is closed,
    check for any changed options and refresh all FB tabs
*/
app.init().then(() => {
    const optionsWindows = new Set();
    const fbTabs = new Map();

    browser.tabs.onUpdated.addListener(id => {
        if (fbTabs.has(id))
            browser.pageAction.show(id);
        else
            browser.pageAction.hide(id);
    });

    function updateCSS(tabId, opts) {
        const prev = fbTabs.get(tabId);
        const details = {
            cssOrigin: "user",
            code: opts.useStyle ? `.${app.styleClass} { ${opts.modStyle}; }` : "",
        }
        fbTabs.set(tabId, details);

        // F***ing Chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=608854
        if (browser.tabs.removeCSS) {
            if (prev && prev.code)
                browser.tabs.removeCSS(tabId, prev).catch(app.warn);
            if (details.code)
                browser.tabs.insertCSS(tabId, details).catch(app.warn);
        } else {
            browser.tabs.sendMessage(tabId, details.code)
        }
    }

    const STYLE_OPTS = ["useStyle", "modStyle"];
    function handleChanged(old, mew) {
        if (!(old.enabled || mew.enabled))
            return Promise.reject("Disabled");

        let reload = false;
        let restyle = false;
        for (const k in old) {
            if (old[k] != mew[k]) {
                if (STYLE_OPTS.includes(k))
                    restyle = true;
                else {
                    reload = true;
                    break;
                }
            }
        }

        if (reload)
            fbTabs.forEach((_, tabId) => browser.tabs.reload(tabId));
        else if (restyle)
            fbTabs.forEach((_, tabId) => updateCSS(tabId, mew));

        return reload || restyle ? Promise.resolve() : Promise.reject("No Changes");
    }

    function onUnload(w) {
        optionsWindows.delete(w);

        app.storage.get(app.defaults)
            .then(opts => handleChanged(app.options, opts))
            .then(app.init)
            .catch(app.log);
    }

    browser.runtime.onMessage.addListener((msg, sender) => {
        if (msg === "OPTIONS") {
            browser.extension.getViews()
                .filter(w => !optionsWindows.has(w) && (w.location.pathname === "/src/options.html"))
                .forEach(w => {
                    optionsWindows.add(w);
                    w.addEventListener("unload", () => onUnload(w));
                });
        } else {
            updateCSS(sender.tab.id, msg);
            browser.pageAction.show(sender.tab.id);
        }
    });

    browser.tabs.onRemoved.addListener(fbTabs.delete.bind(fbTabs));
    browser.tabs.onReplaced.addListener(fbTabs.delete.bind(fbTabs));

    function blockRequest(details) {
        if (app.options.enabled) {
          app.log("Blocking tracking request to " + details.url);
          return {cancel: true};
        }
    }

    function* genBlockUrls(paths) {
        for (let h of app.host_patterns)
            for (let p of paths)
                yield h.replace(/\*$/, p);
    }

    browser.webRequest.onBeforeRequest.addListener(
        blockRequest,
        {urls: [...genBlockUrls(["ajax/bz", "xti.php?*"]), ...app.host_patterns.map(h => h.replace("*.", "pixel."))]},
        ["blocking"]
    );
}).catch(console.warn);
