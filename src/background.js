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
