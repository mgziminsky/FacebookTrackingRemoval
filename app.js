console.log("Initializing Tracking Removal");

// Only load once at beginning for consistency
var options = {
    useStyle: true,
    modStyle: "border: 1px dashed green"
};
if (typeof(chrome) !== "undefined" && chrome.storage) {
    chrome.storage.local.get(options, function(opts) {
        options = opts;
        console.log(options);
    });
}

function removeLinkTracking(node) {
    var trackedLinks = node.querySelectorAll("a[onclick^='LinkshimAsyncLink.referrer_log']");
    for (var a of trackedLinks) {
        var mouseover = a.getAttribute("onmouseover");
        var newHref = extractQuotedString(mouseover).replace(/\\(.)/g, '$1');

        a.href = newHref;
        if (options.useStyle) a.style = options.modStyle;
        a.removeAttribute("onmouseover");
        a.removeAttribute("onclick");
        a.addEventListener("click", stopPropagation, false);
        a.addEventListener("mousedown", stopPropagation, false);

        console.log("Removed tracking from link: " + a);
    }
    return trackedLinks.length;
}

var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        for (var node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && removeLinkTracking(node)) {
                mutation.target.addEventListener("click", restrictEventPropagation, true);
                mutation.target.addEventListener("mousedown", restrictEventPropagation, true);
            }
        }
    });
});

observer.observe(document, { childList: true, subtree: true, attributes: false, characterData: false });
removeLinkTracking(document);
