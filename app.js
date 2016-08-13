(function(w) {


// Add a link to the options page in the menu on mobile
function addOptionsLink() {
    const menu = document.getElementById("bookmarks_jewel");
    if (menu) {
        const link = document.createElement("a");
        link.innerText = "Tracking Removal Options";
        link.href = chrome.runtime.getURL("options.html");
        link.className = "_52x6 _5lut _5luu touchable";
        link.target = "_top";

        const flyout = menu.querySelector(".flyout");
        flyout.insertBefore(link, flyout.firstChild);
    }
}

function init(options) {
    addOptionsLink();

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
        // Desktop only
        function cleanShimLinks(node) {
            const trackedLinks = node.querySelectorAll("a[onclick^='LinkshimAsyncLink.referrer_log']");
            for (let a of trackedLinks) {
                cleanLink(a, extractQuotedString(a.getAttribute("onmouseover")).replace(/\\(.)/g, '$1'));
                console.log("Removed tracking from shim link: " + a);
            }
            return trackedLinks.length;
        }

        // Mobile only
        function cleanDataStoreLinks(node) {
            const trackedLinks = node.querySelectorAll("a[data-sigil='MLinkshim'][data-store]");
            for (let a of trackedLinks) {
                cleanLink(a, JSON.parse(a.getAttribute("data-store")).dest_uri);
                console.log("Removed tracking from data-store link: " + a);
            }
            return trackedLinks.length;
        }

        // Desktop and Mobile
        function cleanRedirectLinks(node) {
            const trackedLinks = node.querySelectorAll("a[href*='facebook.com/l.php?']");
            for (let a of trackedLinks) {
                const newHref = decodeURIComponent((/\bu=([^&]*)/).exec(a.href)[1]);
                cleanLink(a, newHref);
                console.log("Removed tracking from redirect link: " + a);
            }
            return trackedLinks.length;
        }

        // Mobile only?
        function fixVideoLinks(node) {
            const videoLinks = node.querySelectorAll("a[href^='/video_redirect/']");
            for (let a of videoLinks) {
                const vidSrc = decodeURIComponent((/\bsrc=([^&]*)/).exec(a.href)[1]);
                if (options.inlineVids) {
                    const poster = extractQuotedString(a.querySelector("i.img").style.backgroundImage);
                    const video = buildVideo(vidSrc, poster);
                    a.parentNode.replaceChild(video, a);
                    console.log("Inlined linked video: " + video.src);
                } else {
                    cleanLink(a, vidSrc);
                    console.log("Removed redirect from video link: " + a)
                }
            }
        }

        // Desktop and Mobile
        function removePixeledArticles(node) {
            const pixels = node.parentNode.querySelectorAll(".fbEmuTracking");
            for (let ad of pixels) {
                const del = ad.parentNode;
                del.parentNode.removeChild(del);
                console.log("Removed pixeled article");
            }
        }

        function removeLinkTracking(node) {
            return cleanShimLinks(node)
                   + cleanDataStoreLinks(node)
                   + cleanRedirectLinks(node)
                   + fixVideoLinks(node);
        }

        new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE)
                        continue;

                    if (options.delPixeled)
                        removePixeledArticles(node);

                    if (removeLinkTracking(node)) {
                        mutation.target.addEventListener("click", restrictEventPropagation, true);
                        mutation.target.addEventListener("mousedown", restrictEventPropagation, true);
                    }
                }
            });
        }).observe(document, { childList: true, subtree: true, attributes: false, characterData: false });

        removeLinkTracking(document);
    }

    if (options.fixVideos) {
        // Desktop only
        function removeVideoTracking(video) {
            if (video.nodeName === "VIDEO" && video.src) {
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
}

const defaultOptions = {
    "fixLinks":   true,
    "inlineVids": false,
    "fixVideos":  true,
    "delPixeled": true,
    "useStyle":   true,
    "modStyle":   "border: 1px dashed green"
};

// Only load once at beginning for consistency
if (typeof(chrome) !== "undefined" && chrome.storage) {
    chrome.storage.local.get(defaultOptions, init);
} else {
    init(defaultOptions);
}


}(window));
