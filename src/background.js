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

'use strict';

// Do some cleanup after updating to 1.6.4+ for the first time
// to get rid of old storage data that is no longer used
browser.runtime.onInstalled.addListener(details => {
    // Not an update
    if (!details.previousVersion)
        return;

    // Always force refresh rules after an update for simplicity
    // 1.8.0 changed the dynamic rules format
    browser.storage.local.remove(["lastRuleRefresh", "hide_rules"])
        .finally(refreshRules.bind(undefined, { force: true }));

    if (details.previousVersion <= "1.6.3")
        app.init().then(async () => {
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

    function updateCSS(id, opts) {
        const prev = fbTabs.get(id);
        const [tabId, frameId] = id.split("#").map(x => parseInt(x));
        const details = {
            frameId,
            cssOrigin: "user",
            code: opts.useStyle ? `.${app.styleClass} { ${opts.modStyle}; }` : "",
        };
        fbTabs.set(id, details);

        // F***ing Chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=608854 (Fixed 2020-11)
        if (browser.tabs.removeCSS) {
            if (prev && prev.code)
                browser.tabs.removeCSS(tabId, prev).catch(app.warn);
            if (details.code)
                browser.tabs.insertCSS(tabId, details).catch(app.warn);
        } else {
            browser.tabs.sendMessage(tabId, { type: "STYLE", data: details.code }).catch(app.warn);
        }
    }

    function reloadTabs() {
        [...fbTabs.keys()].filter(id => id.endsWith("#0")).forEach(tabId => browser.tabs.reload(parseInt(tabId)));
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
            reloadTabs();
        else if (restyle)
            fbTabs.forEach((_, tabId) => updateCSS(tabId, mew));

        return reload || restyle ? Promise.resolve() : Promise.reject("No Changes");
    }

    function onUnload(w) {
        optionsWindows.delete(w);

        app.storage.get(app.defaults)
            .then(opts => handleChanged(app.options, opts))
            .then(app.init)
            .catch(app.warn);
    }

    browser.runtime.onMessage.addListener((msg, sender) => {
        if (msg === "OPTIONS") {
            browser.extension.getViews()
                .filter(w => !optionsWindows.has(w) && (w.location.pathname === "/src/options.html"))
                .forEach(w => {
                    optionsWindows.add(w);
                    w.addEventListener("unload", () => onUnload(w));
                });
        }
        else if (msg === "RELOAD") {
            reloadTabs();
        } else {
            updateCSS(`${sender.tab.id}#${sender.frameId || 0}`, msg);
            if (app.isChrome)
                browser.pageAction.show(sender.tab.id);
        }
    });

    browser.tabs.onRemoved.addListener(fbTabs.delete.bind(fbTabs));
    browser.tabs.onReplaced.addListener(fbTabs.delete.bind(fbTabs));

    /**
     * @param {browser.webRequest._OnBeforeRequestDetails} details
     * @param {boolean} forceBlock
     * @return {browser.webRequest.BlockingResponse}
     */
    function checkRequest(details, forceBlock) {
        if (!app.options.enabled)
            return;

        if (forceBlock || ["beacon", "ping"].includes(details.type)) {
            app.log(`Blocking ${details.type} request to ${details.url}`);
            return { cancel: true };
        }
    }

    function* genBlockUrls(paths) {
        for (let h of app.host_patterns)
            for (let p of paths)
                yield h.replace(/\*$/, p);
    }

    browser.webRequest.onBeforeRequest.addListener(
        details => checkRequest(details, true),
        { urls: [...genBlockUrls(["ajax/bz*", "ajax/bnzai*", "xti.php?*"]), ...app.host_patterns.map(h => h.replace("*.", "pixel."))] },
        ["blocking"]
    );

    browser.webRequest.onBeforeRequest.addListener(
        checkRequest,
        { urls: app.host_patterns },
        ["blocking"]
    );

    browser.webNavigation.onHistoryStateUpdated.addListener(details => {
        const orig = details.url;
        const clean = cleanLinkParams(details.url);
        if (orig != clean) {
            browser.tabs.sendMessage(details.tabId, { type: "HISTORY", data: { orig, clean } });
        }
    }, {
        url: app.host_patterns
            .map(h => h.replaceAll(/[^.\w]/g, ""))
            .map(hostContains => ({ hostContains }))
    });
}).catch(x => console.warn("background init failed:", x));
