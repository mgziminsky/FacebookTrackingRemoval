'use strict';
app.init().then(() => {
    if (!app.options.enabled)
        return;

    function applyStyle(elem) {
        if (app.options.useStyle)
            elem.style.cssText += app.options.modStyle;
    }

    function hide(elem, label) {
        if (app.options.hideMethod === "collapse") {
            if (elem.closest(".fbtrCollapsible"))
                return;

            const wrapper = buildCollapsible(label);
            applyStyle(wrapper);
            for (let c of elem.classList)
                wrapper.classList.add(c);

            elem.parentNode.appendChild(wrapper);
            wrapper.appendChild(elem);
            app.log("Collapsed " + label);
        } else {
            elem.remove();
            app.log("Removed " + label);
        }
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
        video.preload = "metadata";
        video.controls = true;
        video.poster = poster;
        video.setAttribute("width", "100%");
        video.src = src;
        applyStyle(video);
        return video;
    }

    /**** LINK TRACKING ****/

    // Desktop only
    function cleanShimLinks(node) {
        const trackedLinks = node.querySelectorAll("a[onclick^='LinkshimAsyncLink.referrer_log']");
        for (let a of trackedLinks) {
            cleanLink(a, extractQuotedString(a.getAttribute("onmouseover")).replace(/\\(.)/g, '$1'));
            app.log("Removed tracking from shim link: " + a);
        }
        return trackedLinks.length;
    }

    // Mobile only
    function fixVideoLinks(node) {
        const videoLinks = node.querySelectorAll("div[data-sigil=inlineVideo]");
        for (let vid of videoLinks) {
            const vidSrc = JSON.parse(vid.getAttribute("data-store")).src;

            const replaceVideo = target => {
                const poster = extractQuotedString(target.querySelector(".img").style.backgroundImage);
                const video = buildVideo(vidSrc, poster);
                target.parentNode.replaceChild(video, target);
                return video;
            };

            if (app.options.inlineVids) {
                app.log("Inlined video: " + replaceVideo(vid).src);
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
                app.log("Cleaned deferred inline video: " + vidSrc)
            }
        }
        return videoLinks.length;
    }

    // Desktop and Mobile
    function cleanRedirectLinks(node) {
        const trackedLinks = node.querySelectorAll("a[href*='facebook.com/l.php?']");
        for (let a of trackedLinks) {
            const newHref = decodeURIComponent((/\bu=([^&]*)/).exec(a.href)[1]);
            cleanLink(a, newHref);
            app.log("Removed tracking from redirect link: " + a);
        }
        return trackedLinks.length;
    }

    const _internalLinkSelector = `a[href^='/'],a[href^='#'][ajaxify],a[href^='${location.origin}']`;
    function stripRefs(node) {
        const intLinks = node.querySelectorAll(_internalLinkSelector);
        for (let a of intLinks) {
            const before = a.cloneNode();
            const href = a.href;
            a.href = cleanLinkParams(href);

            let cleaned = (a.href != href);

            if (a.hasAttribute("ajaxify")) {
                const ajaxify = a.getAttribute("ajaxify");
                a.setAttribute("ajaxify", cleanLinkParams(ajaxify));
                cleaned = (ajaxify != a.getAttribute("ajaxify"));
            }

            if (cleaned) {
                applyStyle(a);
                app.log("Cleaned internal link params:\n\t" + before + "\n\t" + a.href);
            }
        }
        return intLinks.length;
    }

    function removeLinkTracking(node) {
        return cleanShimLinks(node)
               + fixVideoLinks(node)
               + cleanRedirectLinks(node)
               ;
    }

    /**** END LINK TRACKING ****/

    function removeSponsored(node) {
        const pixels = node.querySelectorAll(".fbEmuTracking");
        for (let pixel of pixels) {
            hide(pixel.parentNode, "Sponsored Article");
            pixel.remove();
        }
    }

    const _suggestionsSelector = [
        "div._3653", // Sidebar Content
        "div._50f4", // Related Articles
        "div._5_xt", // Popular Across Facebook
        "div._5g-l", // A Video You May Like
        "h3._5x3-",  // Suggested Post???
        "span.fcb"   // People You May Know
    ].join(",");
    function removeSuggestions(node) {
        const elements = node.querySelectorAll(_suggestionsSelector);
        for (let e of elements) {
            hide(e.closest("div.pagelet,div.mbm,div._55wo"), e.innerText);
        }
    }

    app.log("Initializing Tracking Removal");
    app.log(JSON.stringify(app.options));
    const body = document.body;

    new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                const target = mutation.target;

                if (app.options.internalRefs)
                    stripRefs(target);

                if (app.options.delSuggest)
                    removeSuggestions(target);

                if (app.options.delPixeled)
                    removeSponsored(target);

                if (app.options.fixLinks) {
                    for (let node of mutation.addedNodes) {
                        if (node.nodeType == Node.ELEMENT_NODE && removeLinkTracking(node)) {
                            node.addEventListener("click", restrictEventPropagation, true);
                            node.addEventListener("mousedown", restrictEventPropagation, true);
                        }
                    }
                }
            }
        });
    }).observe(body, { childList: true, subtree: true, attributes: false, characterData: false });

    if (app.options.internalRefs)
        stripRefs(body);
    if (app.options.delSuggest)
        removeSuggestions(body);
    if (app.options.delPixeled)
        removeSponsored(body);

    if (app.options.fixLinks && removeLinkTracking(body) && document.getElementById("newsFeedHeading")) {
        const feed = document.getElementById("newsFeedHeading").parentNode;
        for (let stream of feed.querySelectorAll("div._4ikz")) {
            stream.addEventListener("click", restrictEventPropagation, true);
            stream.addEventListener("mousedown", restrictEventPropagation, true);
        }
    }

    if (app.options.fixVideos) {
        // Desktop only
        function removeVideoTracking(video) {
            if (video.nodeName === "VIDEO" && video.src) {
                const img = video.parentNode.querySelector("img._1445");
                if (!img) return;

                const poster = extractQuotedString(img.style.backgroundImage);
                const cleanVideo = buildVideo(video.src, poster);

                const replaceTarget = video.closest("span._3m6-") || video.parentNode;
                replaceTarget.parentNode.replaceChild(cleanVideo, replaceTarget);

                app.log("Removed tracking from video: " + cleanVideo.src);
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
}, console.log);
