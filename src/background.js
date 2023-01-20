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

import { isChrome, log, warn } from "./common.js";
import * as config from "./config.js";
import { STYLE_CLASS } from "./consts.js";
import refreshRules from "./rules_sync.js";
import { cleanLinkParams } from "./util.js";


// Do some cleanup after updating to 1.6.4+ for the first time
// to get rid of old storage data that is no longer used
browser.runtime.onInstalled.addListener(details => {
    // Not an update
    if (!details.previousVersion || details.previousVersion === browser.runtime.getManifest().version)
        return;

    // Always force refresh rules after an update for simplicity
    // 1.8.0 changed the dynamic rules format
    browser.storage.local.remove(["lastRuleRefresh", "hide_rules"])
        .finally(refreshRules.bind(undefined, { force: true }));

    const old = [1, 6, 3];
    const prev = details.previousVersion.split(".").map(Number);
    if (!details.temporary && prev.every((v, i) => v <= (old[i] ?? 0))) {
        const currentOpts = config.options;
        config.storage.clear();
        browser.storage.local.clear();
        config.storage.set(currentOpts);
        browser.runtime.reload();
    }
});

// refresh rules every 12 hours
browser.alarms.onAlarm.addListener(() => refreshRules().catch(() => {/* Ignore timeout */ }));
browser.alarms.create({ delayInMinutes: 1/60, periodInMinutes: 60 * 12 });

/**
 * Keep track of open FB pages for updating the CSS
 *  @type {Map<string, browser.extensionTypes.InjectDetails}
 */
const fbTabs = new Map();

/**
 * @param {number} tabId
 * @param {number} frameId
 */
function updateCSS(tabId, frameId) {
    const prev = fbTabs.get(tabId);
    const details = {
        frameId,
        cssOrigin: "user",
        code: config.options.useStyle ? `.${STYLE_CLASS} { ${config.options.modStyle}; }` : "",
    };
    fbTabs.set(`${tabId}#${frameId}`, details);

    if (prev && prev.code)
        browser.tabs.removeCSS(tabId, prev).catch(warn);
    if (details.code)
        browser.tabs.insertCSS(tabId, details).catch(warn);
}

function reloadTabs() {
    [...fbTabs.keys()].filter(id => id.endsWith("#0")).forEach(tabId => browser.tabs.reload(parseInt(tabId)));
}

browser.runtime.onMessage.addListener(({ msg, args }, sender, sendResponse) => {
    if (msg === "CSS") {
        updateCSS(sender.tab.id, sender.frameId ?? 0);
        if (isChrome)
            browser.pageAction.show(sender.tab.id);
    }
    else if (msg === "REFRESH") {
        refreshRules(args)
            .then(t => args.check ? t : (reloadTabs(), t)) // Reload tabs if this isn't just a check
            .then(sendResponse, e => sendResponse(Promise.reject(e)));
        return true; // Allow async response
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
    if (!config.options.enabled)
        return;

    if (forceBlock || ["beacon", "ping"].includes(details.type)) {
        log(`Blocking ${details.type} request to ${details.url}`);
        return { cancel: true };
    }
}

function* genBlockUrls(paths) {
    for (const h of config.host_patterns)
        for (const p of paths)
            yield h.replace(/\*$/, p);
}

browser.webRequest.onBeforeRequest.addListener(
    details => checkRequest(details, true),
    { urls: [...genBlockUrls(["ajax/bz*", "ajax/bnzai*", "xti.php?*"]), ...config.host_patterns.map(h => h.replace("*.", "pixel."))] },
    ["blocking"]
);

browser.webRequest.onBeforeRequest.addListener(
    checkRequest,
    { urls: config.host_patterns },
    ["blocking"]
);

browser.webNavigation.onHistoryStateUpdated.addListener(details => {
    const orig = details.url;
    const clean = cleanLinkParams(details.url);
    if (orig != clean) {
        browser.tabs.sendMessage(details.tabId, { type: "HISTORY", data: { orig, clean } });
    }
}, {
    url: config.host_patterns
        .map(h => h.replaceAll(/[^.\w]/g, ""))
        .map(hostContains => ({ hostContains }))
});
