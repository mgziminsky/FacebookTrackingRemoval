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

    Copyright (C) 2016-2022 Michael Ziminsky
*/

import { isChrome, log, warn } from "../common.js";
import { options, storage } from "../config.js";
import { CHROME_PORT, MSG, NOOP, STYLE_CLASS } from "../consts.js";
import { refreshRules } from "../rules_sync.js";
import "./webrequest.js";


// Do some cleanup after updating to 1.6.4+ for the first time
// to get rid of old storage data that is no longer used
browser.runtime.onInstalled.addListener(details => {
    // Not an update
    if (!details.previousVersion || details.previousVersion === browser.runtime.getManifest().version)
        return;

    // Always force refresh rules after an update for simplicity
    // 1.8.0 changed the dynamic rules format
    browser.storage.local.remove(["lastRuleRefresh", "hide_rules"])
        .finally(refreshRules.bind(undefined, true));

    const old = [1, 6, 3];
    const prev = details.previousVersion.split(".").map(Number);
    if (!details.temporary && prev.every((v, i) => v <= (old[i] ?? 0))) {
        const currentOpts = options;
        storage.clear();
        browser.storage.local.clear();
        storage.set(currentOpts);
        browser.runtime.reload();
    }
});


/**
 * @param {(tabId: number, details: browser.extensionTypes.InjectDetails) => Promise<void>} action
 * @param {string?} style
 * @param {number} tabId
 * @param {number} frameId
 */
function updateCSS(action, style, tabId, frameId) {
    action(tabId, {
        frameId,
        cssOrigin: "user",
        code: style ? `.${STYLE_CLASS} { ${style}; }` : "",
    }).catch(warn);
}

/**
 * @param {{msg: string}}
 * @param {browser.runtime.MessageSender} sender
 */
function onMessage({ msg, ...data }, sender) {
    switch (msg) {
        case MSG.chromeShow:
            browser.pageAction.show(sender.tab.id);
            break;
        case MSG.insertCss:
            updateCSS(browser.tabs.insertCSS, data.style, sender.tab.id, sender.frameId);
            break;
        case MSG.removeCss:
            updateCSS(browser.tabs.removeCSS, data.style, sender.tab.id, sender.frameId);
            break;
        case MSG.rulesRefresh:
            return refreshRules(data.force);
    }
}
browser.runtime.onMessage.addListener(onMessage);

if (isChrome) {
    // alarms have a min delay of 1 minute...
    refreshRules().catch(NOOP);

    // Popups don't fire unload on close, have to handle it from here
    browser.runtime.onConnect.addListener(port => {
        log("Options Connect");
        if (port.name === CHROME_PORT) {
            let changes = {};
            port.onMessage.addListener(data => changes = data);
            port.onDisconnect.addListener(() => {
                log("Options Disconnect");
                if (Object.keys(changes).length)
                    Object.assign(options, changes);
            });
        }
    });
}
