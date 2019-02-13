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

if (browser.pageAction) {
    function checkHost(url) {
        const hostname = new URL(url).hostname;
        return app.domains.some(d => hostname.endsWith("." + d));
    }

    browser.tabs.onUpdated.addListener((id, changes, tab) => {
        if (tab.url && checkHost(tab.url))
            browser.pageAction.show(id);
        else
            browser.pageAction.hide(id);
    });
}

refreshRules();
setInterval(refreshRules, 1000 * 60 * 60 * 12); // refresh every 12 hours

/*
    Keep track of open options windows and the currently
    active options. When an options window is closed,
    check for any changed options and reload all tabs
*/
app.init().then(() => {
    const optionsWindows = new Set();

    function checkChanged(a, b) {
        if (!(a.enabled || b.enabled))
            return Promise.reject("Disabled");

        for (const k in a)
            if (a[k] != b[k])
                return Promise.resolve();

        return Promise.reject("No Changes");
    }

    function onUnload(w) {
        optionsWindows.delete(w);

        app.storage.get(app.defaults)
            .then(opts => checkChanged(app.options, opts))
            .then(app.reloadTabs)
            .then(app.init)
            .catch(app.log);
    }

    browser.runtime.onMessage.addListener(msg => {
        browser.extension.getViews()
            .filter(w => !optionsWindows.has(w) && (w.location.pathname === "/src/options.html"))
            .forEach(w => {
                optionsWindows.add(w);
                w.addEventListener("unload", () => onUnload(w));
            });
    });


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
}).catch(console.log);
