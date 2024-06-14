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

import * as config from "../config.js";
import { MSG } from "../consts.js";
import { cleanLinkParams } from "../util.js";

browser.webNavigation.onHistoryStateUpdated.addListener(
    details => {
        if (!config.options.enabled) return;

        const orig = details.url;
        const clean = cleanLinkParams(details.url);
        if (orig !== clean) {
            browser.tabs.sendMessage(details.tabId, { type: MSG.history, orig, clean });
        }
    },
    {
        url: config.host_patterns.map(h => h.replaceAll(/[^.\w]/g, "")).map(hostContains => ({ hostContains })),
    },
);

function updateRuleset(enable) {
    if (enable === true) {
        browser.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ["ruleset"] });
    } else if (enable === false) {
        browser.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ["ruleset"] });
    }
}
config.storage.onChanged.addListener(({ enabled }) => updateRuleset(enabled?.newValue));
browser.runtime.onInstalled.addListener(() => {
    // Disable blocking rules on update since they get reset back to the extension default
    config.READY.then(() => updateRuleset(config.options.enabled));
});
