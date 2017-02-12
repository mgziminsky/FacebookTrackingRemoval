(function() {
    // Add a link to the options page in the menu on mobile
    const menu = document.getElementById("bookmarks_jewel");
    if (menu) {
        const link = document.createElement("a");
        link.innerText = "Tracking Removal Options";
        link.href = chrome.runtime.getURL("src/options.html");
        link.className = "_52x6 _52x7 _5lut _5luu touchable";
        link.target = "_top";

        const flyout = menu.querySelector(".flyout");
        flyout.insertBefore(link, flyout.firstChild);
    }

    // Only load once at beginning for consistency
    if (typeof(chrome) !== "undefined" && chrome.storage) {
        chrome.storage.local.get(defaultOptions, FBTR.init);
    } else {
        FBTR.init(defaultOptions);
    }
}());
