const FBTR = {
    options: defaultOptions,
    inited: false,

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
            log("Collapsed " + label);
        } else {
            elem.remove();
            log("Removed " + label);
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
    fixVideoLinks: function(node) {
        const videoLinks = node.querySelectorAll("div[data-sigil=inlineVideo]");
        for (let vid of videoLinks) {
            const vidSrc = JSON.parse(vid.getAttribute("data-store")).src;

            const replaceVideo = target => {
                const poster = extractQuotedString(target.querySelector(".img").style.backgroundImage);
                const video = FBTR.buildVideo(vidSrc, poster);
                target.parentNode.replaceChild(video, target);
                return video;
            };

            if (FBTR.options.inlineVids) {
                log("Inlined video: " + replaceVideo(vid).src);
            } else {
                removeAllAttrs(vid);
                const target = vid.cloneNode(true);
                target.classList.add("FBTR-SAFE")
                target.addEventListener("click", e => {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    replaceVideo(target).play();
                }, true);
                vid.parentNode.replaceChild(target, vid);
                log("Cleaned deferred inline video: " + vidSrc)
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
               + FBTR.fixVideoLinks(node)
               + FBTR.cleanRedirectLinks(node)
               ;
    },

    /**** END LINK TRACKING ****/

    removeSponsored: function(node) {
        const pixels = node.querySelectorAll(".fbEmuTracking");
        for (let pixel of pixels) {
            FBTR.hide(pixel.parentNode, "Sponsored Article");
            pixel.remove();
        }
    },

    removeSuggestions: function(node) {
        const elements = node.querySelectorAll("div._5g-l,span.fcb,h3._5x3-");
        for (let e of elements) {
            FBTR.hide(e.closest("div.mbm,div._55wo"), e.innerText);
        }
    },

    init: function() {
        return getOptions().then(options => {
            if (FBTR.inited) return;

            FBTR.options = Object.assign({}, FBTR.options, options);

            if (FBTR.options.logging)
                log = console.log.bind(console);
            else
                log = function(){};

            log("Initializing Tracking Removal");
            log(FBTR.options);
            const body = document.body;

            new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes.length) {
                        const target = mutation.target;

                        if (FBTR.options.delPixeled)
                            FBTR.removeSponsored(target);

                        if (FBTR.options.delSuggest)
                            FBTR.removeSuggestions(target);

                        if (FBTR.options.fixLinks) {
                            for (let node of mutation.addedNodes) {
                                if (node.nodeType == Node.ELEMENT_NODE && FBTR.removeLinkTracking(node)) {
                                    node.addEventListener("click", restrictEventPropagation, true);
                                    node.addEventListener("mousedown", restrictEventPropagation, true);
                                }
                            }
                        }
                    }
                });
            }).observe(body, { childList: true, subtree: true, attributes: false, characterData: false });

            if (FBTR.options.delSuggest)
                FBTR.removeSuggestions(body);
            if (FBTR.options.delPixeled) {
                const ego_pane = document.getElementById("pagelet_ego_pane");
                if (ego_pane) FBTR.hide(ego_pane, "Sponsored Ads");
                FBTR.removeSponsored(body);
            }
            if (FBTR.options.fixLinks && FBTR.removeLinkTracking(body) && document.getElementById("newsFeedHeading")) {
                const feed = document.getElementById("newsFeedHeading").parentNode;
                for (let stream of feed.querySelectorAll("div._4ikz")) {
                    stream.addEventListener("click", restrictEventPropagation, true);
                    stream.addEventListener("mousedown", restrictEventPropagation, true);
                }
            }

            if (FBTR.options.fixVideos) {
                // Desktop only
                function removeVideoTracking(video) {
                    if (video.nodeName === "VIDEO" && video.src) {
                        const img = video.parentNode.querySelector("img._1445");
                        if (!img) return;

                        const poster = extractQuotedString(img.style.backgroundImage);
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
                }).observe(body, { attributes: true, attributeFilter: ["src"], subtree: true, childList: false, characterData: false });

                for (let video of body.querySelectorAll("video[src]"))
                    removeVideoTracking(video);
            }

            FBTR.inited = true;
        });
    }
};

FBTR.init().catch(console.log);
