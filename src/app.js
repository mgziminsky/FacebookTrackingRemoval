/*  This file is part of FacebookTrackingRemoval.

    FacebookTrackingRemoval is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FacebookTrackingRemoval is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FacebookTrackingRemoval.  If not, see <http://www.gnu.org/licenses/>.

    Copyright (C) 2016-2018 Michael Ziminsky
*/

'use strict';

app.init().then(() => {
    if (!app.options.enabled)
        return;

    const _suggestionsSelector = [
        "div._3653",                    // Sidebar Content
        "div._50f4",                    // Related Articles/FB Promotions
        "div._5_xt",                    // Popular Across Facebook
        "div._5g-l",                    // A Video You May Like
        "h3._5x3-",                     // Suggested Post???
        "div.y_1hcf_5qplr",             // Suggested Post
        "span.b_1hcf_5oed7",            // Suggested Post
        "span.l_8yb3p1a9o",             // Suggested Post
        "article > header._5rgs",       // Suggested Post (Mobile)
        "span.fcb",                     // People You May Know
        "header._21ik",                 // People You May Know (Mobile)
        "div._d_q",                     // Page Stories You May Like
        "div.fsl",                      // Games You May Like
        "div.ego_section h6",           // Photo overlay suggestions
        "a._pmj",                       // TV Watchlist
    ].join(",");

    const _sponsoredSelector = [
        ".h_1hcf_5rdlb",                // From CSS
        ".x_1hcf_5o896",                // From CSS
        ".w_1hcf_5oxu9 > a",            // From document
        "div._5qc4 > span:first-child", // Mobile
        "a._m8c",                       // "SponSsored" - From document
        "div.b_1hcf_5rqfd",             // "SponSsored" - From document
        "div.v_8yb3ozf_y",              // "SponSsored" - From document
    ].join(",");


    function applyStyle(elem) {
        if (app.options.useStyle)
            elem.style.cssText += app.options.modStyle;
    }

    function hide(elem, label) {
        if (!elem)
            return;

        if (app.options.hideMethod === "collapse") {
            if (elem.closest(".fbtrCollapsible"))
                return;

            const wrapper = buildCollapsible(label);
            applyStyle(wrapper);
            for (const c of elem.classList)
                wrapper.classList.add(c);

            elem.parentNode.appendChild(wrapper);
            wrapper.appendChild(elem);
            app.log("Collapsed " + label);
        } else {
            elem.remove();
            app.log("Removed " + label);
        }
    }

    const supportedProtos = ["http:", "https:", "ftp:"];
    function cleanLink(a, href) {
        cleanAttrs(a);
        try {
            if (supportedProtos.includes(new URL(href, origin).protocol))
                a.href = href;
            else
                app.log("Unsupported link protocol; leaving unchanged: " + href);
        } catch (_) {
            app.log("Link cleaning encountered an invalid url: " + href);
        }
        a.target = "_blank";
        a.rel = "noreferrer";
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
        const trackedLinks = selectAllWithBase(node, "a[onclick^='LinkshimAsyncLink.referrer_log']");
        for (const a of trackedLinks) {
            cleanLink(a, extractQuotedString(a.getAttribute("onmouseover")).replace(/\\(.)/g, '$1'));
            app.log("Removed tracking from shim link: " + a);
        }
        return trackedLinks.length;
    }

    // Mobile only
    function fixVideoLinks(node) {
        const videoLinks = selectAllWithBase(node, "div[data-sigil=inlineVideo],a[href^='/video_redirect/']");
        for (const vid of videoLinks) {
            const vidSrc = vid.tagName === 'DIV'
                           ? JSON.parse(vid.getAttribute("data-store")).src // Phone
                           : new URL(vid.href).searchParams.get('src'); // m.facebook

            const replaceVideo = target => {
                const img = target.querySelector(".img,img"); // phone,m.facebook
                const poster = extractQuotedString(img.style.backgroundImage) || img.src;
                const video = buildVideo(vidSrc, poster);
                target.parentNode.replaceChild(video, target);
                return video;
            };

            if (app.options.inlineVids) {
                app.log("Inlined video: " + replaceVideo(vid).src);
            } else {
                cleanAttrs(vid);
                const target = vid.cloneNode(true);
                applyStyle(target);
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
        const trackedLinks = selectAllWithBase(node, `a[href*='${document.domain}/l.php?']`);
        for (const a of trackedLinks) {
            const newHref = new URL(a.href).searchParams.get('u');
            cleanLink(a, newHref);
            app.log("Removed tracking from redirect link: " + a);
        }
        return trackedLinks.length;
    }

    const _internalLinkSelector = `a[href^='/'],a[href^='#'],a[ajaxify],a[data-hovercard],a[href^='${location.origin}']`;
    function stripRefs(node) {
        const intLinks = selectAllWithBase(node, _internalLinkSelector);
        for (const a of intLinks) {
            applyEventBlockers(a.parentNode);
            delete a.dataset.ft;

            let orig = a.getAttribute("href"); // get unexpanded value
            a.href = cleanLinkParams(orig);

            if (a.getAttribute("href") != orig) {
                applyStyle(a);
                app.log("Cleaned internal href:\n\t" + orig + "\n\t" + a.getAttribute("href"));
            }

            if (a.hasAttribute("ajaxify")) {
                orig = a.getAttribute("ajaxify");
                a.setAttribute("ajaxify", cleanLinkParams(orig));
                if (orig != a.getAttribute("ajaxify")) {
                    applyStyle(a);
                    app.log("Cleaned internal ajaxify link:\n\t" + orig + "\n\t" + a.getAttribute("ajaxify"));
                }
            }

            if (a.dataset.hovercard) {
                orig = a.dataset.hovercard;
                a.dataset.hovercard = cleanLinkParams(orig);
                delete a.dataset.hovercardReferrer;
                if (orig != a.dataset.hovercard) {
                    applyStyle(a);
                    app.log("Cleaned internal hovercard link:\n\t" + orig + "\n\t" + a.dataset.hovercard);
                }
            }
        }
        return intLinks.length;
    }

    function fixGifs(node) {
        const gifs = selectAllWithBase(node, "div._5b-_");
        for (const g of gifs) {
            const target = g.closest("div._2lhm");

            const gif = target.querySelector("img.img").cloneNode(false);
            gif.classList.add("FBTR-SAFE");
            gif.dataset.placeholder = gif.src;
            gif.dataset.src = g.parentNode.href;

            const controls = target.querySelector("div._393-").parentNode.cloneNode(true);
            controls.classList.add("FBTR-SAFE");

            const toggle = (e) => {
                gif.src = controls.classList.toggle("fbtrHide")
                    ? gif.dataset.src
                    : gif.dataset.placeholder;
                stopPropagation(e);
            };
            gif.addEventListener("click", toggle, true);
            controls.addEventListener("click", toggle, true);

            const wrapper = document.createElement("div");
            wrapper.appendChild(gif);
            wrapper.appendChild(controls);

            for (const c of target.classList)
                wrapper.classList.add(c);

            target.parentNode.replaceChild(wrapper, target);
            app.log("Fixed GIF: " + gif.dataset.src);
        }
    }

    function removeLinkTracking(node) {
       const cleaned = cleanShimLinks(node)
           + fixVideoLinks(node)
           + cleanRedirectLinks(node)
           ;
       fixGifs(node);
       return cleaned;
    }

    /**** END LINK TRACKING ****/

    async function removeArticles(node, selector) {
        const elements = selectAllWithBase(node, selector);
        for (const e of elements) {
            if (!e.closest("._3j6k")) { // Skip Emergency Broadcasts. eg: Amber Alert
                hide(e.closest("div.pagelet,div.mbm,div._55wo,article"), e.innerText || getComputedStyle(e, ":after").content);
            }
        }
    }

    const body = document.body;

    new MutationObserver(mutations => {
        async function forEachAdded(mutation, cb) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType == Node.ELEMENT_NODE && !node.classList.contains(PROCESSED_CLASS)) {
                    cb(node);
                }
            }
        }

        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                const target = mutation.target;

                if (app.options.delSuggest)
                    removeArticles(target, _suggestionsSelector);

                if (app.options.delPixeled)
                    removeArticles(target, _sponsoredSelector);

                if (app.options.internalRefs)
                    forEachAdded(mutation, stripRefs);

                if (app.options.fixLinks) {
                    forEachAdded(mutation, node => {
                        if (removeLinkTracking(node))
                            applyEventBlockers(node);
                    });
                }

                forEachAdded(mutation, node => node.classList.toggle(PROCESSED_CLASS, true));
            }
        }
    }).observe(body, { childList: true, subtree: true, attributes: false, characterData: false });

    if (app.options.internalRefs)
        stripRefs(body);
    if (app.options.delSuggest)
        removeArticles(body, _suggestionsSelector);
    if (app.options.delPixeled)
        removeArticles(body, _sponsoredSelector);

    if (app.options.fixLinks && removeLinkTracking(body) && document.getElementById("newsFeedHeading")) {
        const feed = document.getElementById("newsFeedHeading").parentNode;
        for (const stream of feed.querySelectorAll("div._4ikz")) {
            applyEventBlockers(stream);
        }
    }
}, console.warn);
