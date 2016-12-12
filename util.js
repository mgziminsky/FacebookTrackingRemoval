function isAllowedTarget(e) {
    let checkTarget = e.target;

    // Allow clicks on input elements
    if (checkTarget.tagName === "INPUT" || checkTarget.tagName === "SELECT" || checkTarget.tagName === "BUTTON")
        return true;

    // Walk through event target and parents until the currentTarget looking for an anchor link
    while (e.currentTarget !== checkTarget) {
        if (checkTarget.tagName === "A")
            return true;
        checkTarget = checkTarget.parentNode;
    }

    return false;
}

function stopPropagation(e) {
    e.stopPropagation();
}

function extractQuotedString(s) {
    return s.substring(s.indexOf('"') + 1, s.lastIndexOf('"'));
}

function removeAllAttrs(elem) {
    while (elem.attributes.length)
        elem.removeAttribute(elem.attributes[0].name);
}
