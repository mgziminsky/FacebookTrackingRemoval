function init(options) {
    console.log("Initializing Tracking Removal");
    console.log(options);

    function applyStyle(elem) {
        if (options.useStyle)
            elem.style.cssText = options.modStyle;
    }

    function cleanLink(a, href) {
        removeAllAttrs(a);
        a.href = href;
        a.target = "_blank";
        a.addEventListener("click", stopPropagation, false);
        a.addEventListener("mousedown", stopPropagation, false);
        applyStyle(a);
    }

    function buildVideo(src, poster) {
        const video = document.createElement("video");
        video.src = src;
        video.preload = "metadata";
        video.controls = true;
        video.poster = poster;
        video.setAttribute("width", "100%");
        applyStyle(video);
        return video;
    }

    if (options.fixLinks) {
        function cleanShimLinks(node) {
            const trackedLinks = node.querySelectorAll("a[onclick^='LinkshimAsyncLink.referrer_log']");
            for (let a of trackedLinks) {
                cleanLink(a, extractQuotedString(a.getAttribute("onmouseover")).replace(/\\(.)/g, '$1'));
                console.log("Removed tracking from shim link: " + a);
            }
            return trackedLinks.length;
        }

        function cleanRedirectLinks(node) {
            const trackedLinks = node.querySelectorAll("a[href*='facebook.com/l.php?']");
            for (let a of trackedLinks) {
                const newHref = decodeURIComponent((/\bu=([^&]*)/).exec(a.href)[1]);
                cleanLink(a, newHref);
                console.log("Removed tracking from redirect link: " + a);
            }
            return trackedLinks.length;
        }

        function removeLinkTracking(node) {
            return cleanShimLinks(node)
                   + cleanRedirectLinks(node);
        }

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
        function removeVideoTracking(video) {
            if (video.nodeName === "VIDEO") {
                const poster = extractQuotedString(video.parentNode.querySelector("img._1445").style.backgroundImage);
                const cleanVideo = buildVideo(video.src, poster);

                const replaceTarget = closest(video, "span._3m6-") || video.parentNode;
                replaceTarget.parentNode.replaceChild(cleanVideo, replaceTarget);

                console.log("Removed tracking from video: " + cleanVideo.src);
            }
        }

        new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                removeVideoTracking(mutation.target);
            });
        }).observe(document, { attributes: true, attributeFilter: ["src"], subtree: true, childList: false, characterData: false });

        for (let video of document.querySelectorAll("video[src]"))
            removeVideoTracking(video);
    }
};

const defaultOptions = {
    "fixLinks":   true,
    "fixVideos":  true,
    "useStyle":   true,
    "modStyle":   "border: 1px dashed green"
};

// Only load once at beginning for consistency
chrome.storage.sync.get(defaultOptions, init);
