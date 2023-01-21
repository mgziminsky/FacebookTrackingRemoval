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

import { log } from "../common.js";
import * as config from "../config.js";
import { MSG } from "../consts.js";
import { cleanLinkParams } from "../util.js";


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

/** @param {string[]} paths */
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
        browser.tabs.sendMessage(details.tabId, { type: MSG.history, orig, clean });
    }
}, {
    url: config.host_patterns
        .map(h => h.replaceAll(/[^.\w]/g, ""))
        .map(hostContains => ({ hostContains }))
});
