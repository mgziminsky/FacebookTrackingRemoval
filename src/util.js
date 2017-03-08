var log = function(){};

const ALLOWED_CLICK_ELEMENTS = ["A", "INPUT", "SELECT", "BUTTON"];
function isAllowedTarget(e) {
    let checkTarget = e.target;

    // Walk through event target and parents until the currentTarget looking for an element
    while (e.currentTarget !== checkTarget) {
        if (ALLOWED_CLICK_ELEMENTS.includes(checkTarget.tagName) || checkTarget.classList.contains("fbtrCollapsible"))
            return true;
        checkTarget = checkTarget.parentNode;
    }

    return false;
}

// Meant to be used as a capturing event handler
function restrictEventPropagation(e) {
    if (!isAllowedTarget(e))
    {
        log("Prevented propagation of " + e.type + " to " + e.target);
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

function removeAllAttrs(elem) {
    while (elem.attributes.length)
        elem.removeAttribute(elem.attributes[0].name);
}

function buildCollapsible(label) {
    const content = document.createElement("summary");
    content.textContent = label;
    content.classList.add("fbtrLabel");

    const collapsible = document.createElement("details");
    collapsible.classList.add("fbtrCollapsible", "mbm");
    collapsible.appendChild(content);

    return collapsible;
}
