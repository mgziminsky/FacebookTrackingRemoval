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

    Copyright (C) 2016-2019 Michael Ziminsky
*/

'use strict';

// Don't run in IFrames
if (window.self === window.top) {

app.init().then(async () => {
    if (!app.options.enabled)
        return;

    const _userSelector = joinSelectors(app.options.userRules);

    function applyStyle(elem) {
        elem.classList.add(app.styleClass);
    }

    function hide(elem, label) {
        let target;
        if (!elem || !(target = elem.closest(app.hide_rules.article_wrapper)))
            return false;

        if (app.options.hideMethod === "collapse") {
            if (target.closest(".fbtrCollapsible"))
                return false;

            const wrapper = buildCollapsible(label);
            applyStyle(wrapper);
            for (const c of target.classList)
                wrapper.classList.add(c);

            target.parentNode.appendChild(wrapper);
            wrapper.appendChild(target);
            app.log("Collapsed " + label);
        } else {
            target.remove();
            app.log("Removed " + label);
        }
        return true;
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
        a.rel = "noreferrer noopener";
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
        const trackedLinks = selectAllWithBase(node, `a[href*='${document.domain.split(".").slice(-2).join(".")}/l.php?']`);
        for (const a of trackedLinks) {
            const newHref = new URL(a.href).searchParams.get('u');
            cleanLink(a, newHref);
            app.log("Removed tracking from redirect link: " + a);
        }
        return trackedLinks.length;
    }

    function stripFBCLID(node) {
        const trackedLinks = selectAllWithBase(node, `a[href*='fbclid='i]`);
        for (const a of trackedLinks) {
            const link = new URL(a.href);
            link.searchParams.delete("fbclid");
            a.href = link.href;
            applyStyle(a);
            app.log("Removed fbclid from link: " + a);
        }
        return trackedLinks.length;
    }

    const _internalLinkSelector = `a[href^='/'],a[href^='#'],a[ajaxify],a[data-hovercard],a[href^='${location.origin}']`;
    function stripRefs(node) {
        const intLinks = selectAllWithBase(node, _internalLinkSelector);
        for (const a of intLinks) {
            applyEventBlockers(a.parentNode);
            delete a.dataset.ft;

            if (a.hasAttribute("href")) {
                let orig = a.getAttribute("href"); // get unexpanded value
                a.href = cleanLinkParams(orig);

                if (a.getAttribute("href") != orig) {
                    applyStyle(a);
                    app.log("Cleaned internal href:\n\t" + orig + "\n\t" + a.getAttribute("href"));
                }
            }

            if (a.hasAttribute("ajaxify")) {
                let orig = a.getAttribute("ajaxify");
                a.setAttribute("ajaxify", cleanLinkParams(orig));
                if (orig != a.getAttribute("ajaxify")) {
                    applyStyle(a);
                    app.log("Cleaned internal ajaxify link:\n\t" + orig + "\n\t" + a.getAttribute("ajaxify"));
                }
            }

            if (a.dataset.hovercard) {
                let orig = a.dataset.hovercard;
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
            if (!target)
                continue;

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
            + stripFBCLID(node)
            ;
        fixGifs(node);
        return cleaned;
    }

    /**** END LINK TRACKING ****/

    function removeArticles(node, selector) {
        if (!selector.trim())
            return;

        const elements = selectAllWithBase(node, selector);
        for (const e of elements) {
            if (!e.closest("._3j6k")) { // Skip Emergency Broadcasts. eg: Amber Alert
                if (hide(e, e.innerText || getComputedStyle(e, ":after").content))
                    app.log(() => {
                        for (const s of selector.split(",")) {
                            if (e.matches(s)) {
                                return `>>> Static Rule matched for ${e.innerText}: ${s}`;
                            }
                        }
                    });
            }
        }
    }

    function removeArticlesDyn(node, rules) {
        for (const [sel, texts] of Object.entries(rules)) {
            for (const e of selectAllWithBase(node, sel)) {
                const elementText = e.innerText
                    || [...e.querySelectorAll("span[data-content]")].filter(x => x.offsetParent != null).map(x => x.dataset.content).join("");

                if (texts.includes(normalizeString(elementText)) && hide(e, elementText)) {
                    app.log(() => {
                        for (const s of sel.split(",")) {
                            if (e.matches(s)) {
                                return `>>> Dynamic Rule matched for ${elementText}: ${sel} = ${s}`;
                            }
                        }
                    });
                }
            }
        }
    }


    let _running = false;
    function run(body) {
        if (_running)
            return;

        new MutationObserver(async mutations => {
            const SKIP = ["SCRIPT", "STYLE"];

            const forEachAdded = (mutation, cb) => {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType == Node.ELEMENT_NODE && !SKIP.includes(node.nodeName) && !node.classList.contains(PROCESSED_CLASS)) {
                        cb(node);
                    }
                }
            };

            for (const mutation of mutations) {
                if (mutation.addedNodes.length && !SKIP.includes(mutation.target.nodeName)) {
                    const target = mutation.target;

                    if (app.options.delSuggest)
                        removeArticles(target, app.hide_rules.suggestions);

                    if (app.options.delPixeled) {
                        removeArticles(target, app.hide_rules.sponsored);

                        // Putting this here for now. If it works out, it can get its own
                        // option and may replace the old static rules
                        removeArticlesDyn(target, app.hide_rules.content);
                    }

                    if (app.options.pendingRules) {
                        removeArticles(target, app.hide_rules.pending);

                        // Same as above...
                        removeArticlesDyn(target, app.hide_rules.content_pending);
                    }

                    if (_userSelector)
                        removeArticles(target, _userSelector);

                    if (app.options.fixLinks) {
                        forEachAdded(mutation, node => {
                            if (removeLinkTracking(node))
                                applyEventBlockers(node);
                        });
                    }

                    if (app.options.internalRefs)
                        forEachAdded(mutation, stripRefs);

                    forEachAdded(mutation, node => node.classList.add(PROCESSED_CLASS));
                } else if (mutation.target) {
                    // This is to handle FB resetting links that have already been cleaned,
                    // but it means any cleaned link will be processed at least twice... :(
                    // Added 10-20ms to processing time of home page in chrome.
                    removeLinkTracking(mutation.target);
                }
            }
        }).observe(body, (() => {
            const opts = { childList: true, subtree: true, characterData: false };
            if (app.options.fixLinks) {
                opts.attributes = true;
                opts.attributeFilter = ["href"];
            }
            return opts;
        })());

        _running = true;

        (async () => {
            if (app.options.delSuggest)
                removeArticles(body, app.hide_rules.suggestions);
            if (app.options.delPixeled)
                removeArticles(body, app.hide_rules.sponsored);
            if (app.options.pendingRules)
                removeArticles(body, app.hide_rules.pending);
            if (_userSelector)
                removeArticles(body, _userSelector);
            if (app.options.internalRefs)
                stripRefs(body);

            if (app.options.fixLinks && removeLinkTracking(body) && document.getElementById("newsFeedHeading")) {
                const feed = document.getElementById("newsFeedHeading").parentNode;
                for (const stream of feed.querySelectorAll("div._4ikz")) {
                    applyEventBlockers(stream);
                }
            }
        })();
    }

    if (document.body) {
        run(document.body);
    } else {
        new MutationObserver((_, self) => {
            const body = document.body;
            if (!body)
                return;
            self.disconnect();
            run(body);
        }).observe(document.documentElement, { childList: true });
    }

    // Fallback for chrome based browsers that don't support tabs.removeCSS
    browser.runtime.onMessage.addListener(msg => {
        let styleElement = document.getElementById('fbtr-style');
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'fbtr-style';
            document.head.append(styleElement);
        }

        if (styleElement.sheet.cssRules.length)
            styleElement.sheet.deleteRule(0);

        if (msg) {
            // Timeout required for page to reparse
            setTimeout(() => styleElement.sheet.insertRule(msg), 50);
        }
    });

    browser.runtime.sendMessage(app.options);

}).catch(console.warn);

}
