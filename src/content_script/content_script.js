import(browser.runtime.getURL("src/content_script/app.js")).catch(e =>
    console.warn(`Failed to load FacebookTrackingRemoval: ${e}`),
);
