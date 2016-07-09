console.log("Initializing Tracking Removal");

// Walk through event target and parents until the currentTarget looking for an anchor link
function isLinkTarget(e) {
    var checkTarget = e.target;
    while (e.currentTarget !== checkTarget) {
        if (checkTarget.tagName === "A")
            return true;

        checkTarget = checkTarget.parentNode;
    }
    return false;
}

// Stops propagation of events that don't include an anchor link in the target hierarchy
// Meant to be used as a capturing event handler
function restrictEventPropagation(e) {
    if (!isLinkTarget(e))
    {
        console.log("Prevented propagation of " + e.type + " to " + e.target);
        e.stopImmediatePropagation();
        e.stopPropagation();
    }
}

function stopPropagation(e) {
    e.stopPropagation();
}

// Only load once at beginning for consistency
var showOutline; chrome.storage.sync.get({"showOutline": true}, function(opts) { showOutline = opts.showOutline; });
function removeTracking(node) {
    var trackedLinks = node.querySelectorAll("a[onclick^='LinkshimAsyncLink.referrer_log']");
    if (trackedLinks.length) {
        for (var a of trackedLinks) {
            var mouseover = a.getAttribute("onmouseover");
            var newHref = mouseover.substring(mouseover.indexOf('"') + 1, mouseover.lastIndexOf('"')).replace(/\\(.)/g, '$1');

            a.href = newHref;
            if (showOutline) a.className = a.className + " fbltr-untracked";
            a.removeAttribute("onmouseover");
            a.removeAttribute("onclick");
            a.addEventListener("click", stopPropagation, false);
            a.addEventListener("mousedown", stopPropagation, false);

            console.log("Removed tracking from link: " + a);
        }
    }
    return trackedLinks.length;
}

var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        for (var node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && removeTracking(node)) {
                mutation.target.addEventListener("click", restrictEventPropagation, true);
                mutation.target.addEventListener("mousedown", restrictEventPropagation, true);
            }
        }
    });
});

observer.observe(document, { childList: true, subtree: true, attributes: false, characterData: false });
removeTracking(document);
