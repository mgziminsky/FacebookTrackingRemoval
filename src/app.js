const FBTR = {
    options: defaultOptions,

    applyStyle: function(elem) {
        if (FBTR.options.useStyle)
            elem.style.cssText = FBTR.options.modStyle;
    },

    hide: function(elem, label) {
        if (FBTR.options.hideMethod === "collapse") {
            if (elem.closest(".fbtrCollapsible"))
                return;

            const wrapper = buildCollapsible(label);
            FBTR.applyStyle(wrapper);
            for (let c of elem.classList)
                wrapper.classList.add(c);

            elem.parentNode.appendChild(wrapper);
            wrapper.appendChild(elem);
        } else {
            elem.remove();
        }
    },

    cleanLink: function(a, href) {
        removeAllAttrs(a);
        a.href = href;
        a.target = "_blank";
        a.addEventListener("click", stopPropagation, false);
        a.addEventListener("mousedown", stopPropagation, false);
        FBTR.applyStyle(a);
    },

    buildVideo: function(src, poster) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.controls = true;
        video.poster = poster;
        video.setAttribute("width", "100%");
        video.src = src;
        FBTR.applyStyle(video);
        return video;
    },

    /**** LINK TRACKING ****/

    // Desktop only
    cleanShimLinks: function(node) {
        const trackedLinks = node.querySelectorAll("a[onclick^='LinkshimAsyncLink.referrer_log']");
        for (let a of trackedLinks) {
            FBTR.cleanLink(a, extractQuotedString(a.getAttribute("onmouseover")).replace(/\\(.)/g, '$1'));
            log("Removed tracking from shim link: " + a);
        }
        return trackedLinks.length;
    },

    // Mobile only
    cleanDataStoreLinks: function(node) {
        const trackedLinks = node.querySelectorAll("a[data-sigil='MLinkshim'][data-store]");
        for (let a of trackedLinks) {
            FBTR.cleanLink(a, JSON.parse(a.getAttribute("data-store")).dest_uri);
            log("Removed tracking from data-store link: " + a);
        }
        return trackedLinks.length;
    },

    // Mobile only?
    fixVideoLinks: function(node) {
        const videoLinks = node.querySelectorAll("a[href^='/video_redirect/']");
        for (let a of videoLinks) {
            const vidSrc = decodeURIComponent((/\bsrc=([^&]*)/).exec(a.href)[1]);
            if (FBTR.options.inlineVids) {
                const poster = extractQuotedString(a.querySelector(".img").style.backgroundImage);
                const video = FBTR.buildVideo(vidSrc, poster);
                a.parentNode.replaceChild(video, a);
                log("Inlined linked video: " + video.src);
            } else {
                FBTR.cleanLink(a, vidSrc);
                log("Removed redirect from video link: " + a)
            }
        }
        return videoLinks.length;
    },

    // Desktop and Mobile
    cleanRedirectLinks: function(node) {
        const trackedLinks = node.querySelectorAll("a[href*='facebook.com/l.php?']");
        for (let a of trackedLinks) {
            const newHref = decodeURIComponent((/\bu=([^&]*)/).exec(a.href)[1]);
            FBTR.cleanLink(a, newHref);
            log("Removed tracking from redirect link: " + a);
        }
        return trackedLinks.length;
    },

    removeLinkTracking: function(node) {
        return FBTR.cleanShimLinks(node)
               + FBTR.cleanDataStoreLinks(node)
               + FBTR.fixVideoLinks(node)
               + FBTR.cleanRedirectLinks(node)
               ;
    },

    /**** END LINK TRACKING ****/

    removeSponsored: function(node) {
        const pixels = (node.parentNode || node).querySelectorAll(".fbEmuTracking");
        for (let pixel of pixels) {
            FBTR.hide(pixel.parentNode, "Sponsored Article");
            pixel.remove();
            log("Sponsored Article Hidden");
        }
    },

    removeSuggestions: function(node) {
        const elements = (node.parentNode || node).querySelectorAll("span._m8d");
        for (let e of elements) {
            e.classList.remove("_m8d"); // avoid infinite recursion
            FBTR.hide(e.closest("div.mbm"), e.innerText);
            log(e.innerText + " Hidden");
        }
    },

    init: function(options) {
        FBTR.options = Object.assign({}, FBTR.options, options);

        if (FBTR.options.logging) {
            log = console.log.bind(console);
        } else {
            log = function(){};
        }

        log("Initializing Tracking Removal");
        log(FBTR.options);

        new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE)
                        continue;

                    if (FBTR.options.delPixeled)
                        FBTR.removeSponsored(node);

                    if (FBTR.options.delSuggest)
                        FBTR.removeSuggestions(node);

                    if (FBTR.options.fixLinks && FBTR.removeLinkTracking(node)) {
                        mutation.target.addEventListener("click", restrictEventPropagation, true);
                        mutation.target.addEventListener("mousedown", restrictEventPropagation, true);
                    }
                }
            });
        }).observe(document, { childList: true, subtree: true, attributes: false, characterData: false });

        if (FBTR.options.delPixeled)
        {
            FBTR.hide(document.getElementById("pagelet_ego_pane"), "Sponsored Ads");
            FBTR.removeSponsored(document);
        }
        if (FBTR.options.delSuggest)
            FBTR.removeSuggestions(document);
        if (FBTR.options.fixLinks)
            FBTR.removeLinkTracking(document);

        if (FBTR.options.fixVideos) {
            // Desktop only
            function removeVideoTracking(video) {
                if (video.nodeName === "VIDEO" && video.src) {
                    const poster = extractQuotedString(video.parentNode.querySelector("img._1445").style.backgroundImage);
                    const cleanVideo = FBTR.buildVideo(video.src, poster);

                    const replaceTarget = video.closest("span._3m6-") || video.parentNode;
                    replaceTarget.parentNode.replaceChild(cleanVideo, replaceTarget);

                    log("Removed tracking from video: " + cleanVideo.src);
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
};
