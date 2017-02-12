(function() {
    // Only load once at beginning for consistency
    if (typeof(chrome) !== "undefined" && chrome.storage) {
        chrome.storage.sync.get(defaultOptions, FBTR.init);
    } else {
        FBTR.init(defaultOptions);
    }
}());
