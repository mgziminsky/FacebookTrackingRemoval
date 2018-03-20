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

if (browser.pageAction) {
    browser.tabs.onUpdated.addListener((id, changes, tab) => {
        if (tab.active && tab.url && new URL(tab.url).hostname.endsWith("facebook.com"))
            browser.pageAction.show(id);
        else
            browser.pageAction.hide(id);
    });
}

browser.runtime.onMessage.addListener(() => {
    browser.tabs.query({url: "*://*.facebook.com/*", windowType: "normal"})
                .then(tabs => tabs.forEach(t => browser.tabs.reload(t.id)))
                .catch(console.log);
});
