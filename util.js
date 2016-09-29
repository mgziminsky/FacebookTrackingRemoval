// Walk through event target and parents until the currentTarget looking for an anchor link
function isAllowedTarget(e) {
    let checkTarget = e.target;

    // Allow clicks on input elements
    if (checkTarget.tagName === "INPUT" || checkTarget.tagName === "SELECT")
        return true;

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
    if (!isAllowedTarget(e))
    {
        console.log("Prevented propagation of " + e.type + " to " + e.target);
        e.stopImmediatePropagation();
        e.stopPropagation();
    }
}

function stopPropagation(e) {
    e.stopPropagation();
}

function closest(node, selector) {
    if (typeof(node.closest) === "function")
        return node.closest(selector);

    let target = node;
    while (target) {
        if (target.matches(selector))
            return target;
        target = target.parentNode;
    }
    return null;
}

function extractQuotedString(s) {
    return s.substring(s.indexOf('"') + 1, s.lastIndexOf('"'));
}

function removeAllAttrs(elem) {
    while (elem.attributes.length)
        elem.removeAttribute(elem.attributes[0].name);
}
