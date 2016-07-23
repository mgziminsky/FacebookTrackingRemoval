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

function extractQuotedString(s) {
    return s.substring(s.indexOf('"') + 1, s.lastIndexOf('"'));
}
