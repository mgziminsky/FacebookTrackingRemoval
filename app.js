console.log("Initializing Tracking Removal");

// Only load once at beginning for consistency
var options = {
    "fixLinks":  true,
    "fixVideos": true,
    "useStyle":  true,
    "modStyle":  "border: 1px dashed green"
};
if (typeof(chrome) !== "undefined" && chrome.storage) {
    chrome.storage.local.get(options, function(opts) {
        options = opts;
        console.log(options);
    });
}

function removeLinkTracking(node) {
    const trackedLinks = node.querySelectorAll("a[onclick^='LinkshimAsyncLink.referrer_log']");
    for (let a of trackedLinks) {
        const mouseover = a.getAttribute("onmouseover");
        const newHref = extractQuotedString(mouseover).replace(/\\(.)/g, '$1');

        a.href = newHref;
        a.removeAttribute("onmouseover");
        a.removeAttribute("onclick");
        a.addEventListener("click", stopPropagation, false);
        a.addEventListener("mousedown", stopPropagation, false);
        if (options.useStyle)
            a.style.cssText = options.modStyle;

        console.log("Removed tracking from link: " + a);
    }
    return trackedLinks.length;
}

function removeVideoTracking(video) {
    if (video.nodeName === "VIDEO") {
        const cleanVideo = video.cloneNode(/*deep*/false);
        const replaceTarget = closest(video, "span._3m6-") || video.parentNode;

        cleanVideo.removeAttribute("id");
        cleanVideo.removeAttribute("class");

        cleanVideo.preload = "metadata";
        cleanVideo.controls = true;
        cleanVideo.poster = extractQuotedString(video.parentNode.querySelector("img._1445").style.backgroundImage);
        if (options.useStyle)
            cleanVideo.style.cssText = options.modStyle;

        replaceTarget.parentNode.replaceChild(cleanVideo, replaceTarget);

        console.log("Removed tracking from video: " + cleanVideo.src);
    }
}

if (options.fixLinks) {
    new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && removeLinkTracking(node)) {
                    mutation.target.addEventListener("click", restrictEventPropagation, true);
                    mutation.target.addEventListener("mousedown", restrictEventPropagation, true);
                }
            }
        });
    }).observe(document, { childList: true, subtree: true, attributes: false, characterData: false });

    removeLinkTracking(document);
}

if (options.fixVideos) {
    new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            removeVideoTracking(mutation.target);
        });
    }).observe(document, { attributes: true, attributeFilter: ["src"], subtree: true, childList: false, characterData: false });

    for (let video of document.querySelectorAll("video[src]"))
        removeVideoTracking(video);
}
