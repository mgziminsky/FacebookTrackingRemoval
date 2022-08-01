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

    Copyright (C) 2016-2022 Michael Ziminsky
*/
/* eslint no-undef: off */

'use strict';

// NOTE: Needs to run in IFrames as well because some options pages are loaded as IFrames

// Activates page action since show_matches isn't supported...
if (app.isChrome)
    browser.runtime.sendMessage({ msg: "CSS", args: {} });

app.init().then(async () => {
    if (!app.options.enabled)
        return;

    const _userRules = initHideRule(parseHideRules(app.options.userRules));

    function applyStyle(elem) {
        elem.classList.add(app.styleClass);
    }

    function hide(elem, label, method) {
        let target;
        if (!elem || !(target = elem.closest(app.hide_rules.article_wrapper))) {
            app.log(`Unable to hide ${label} - ${elem}`);
            return;
        }

        app.log(() => {
            const selector = app.hide_rules.article_wrapper;
            for (const s of selector.split(",")) {
                if (target.matches(s)) {
                    return `>>> Hide matched wrapper for ${target.tagName}: ${selector} = ${s}`;
                }
            }
        });

        if (method === "collapse") {
            if (target.closest(".fbtrCollapsible")){
                app.log(`${label} already collapsed`);
                return;
            }

            const wrapper = buildCollapsible(label);
            applyStyle(wrapper);
            for (const c of target.classList)
                wrapper.classList.add(c);

            target.parentNode.appendChild(wrapper);
            wrapper.appendChild(target);
            app.log("Collapsed " + label);
        } else {
             // Removing breaks things :/ Consider using class instead of inline style?
            (target.closest(":not(:only-child)") || target).style = "display: none !important";
            app.log("Removed " + label);
        }
    }

    const supportedProtos = ["http:", "https:", "ftp:"];
    function cleanLink(a, href) {
        cleanAttrs(a);
        a.target = "_blank";
        a.rel = "noreferrer noopener";
        try {
            if (supportedProtos.includes(new URL(href, origin).protocol))
                a.href = href;
            else
                app.log("Unsupported link protocol; leaving unchanged: " + href);
        } catch (_) {
            app.log("Link cleaning encountered an invalid url: " + href);
        }
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

    /* LINK TRACKING */

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
                target.classList.add("FBTR-SAFE");
                target.addEventListener("click", e => {
                    e.stopImmediatePropagation();
                    e.stopPropagation();
                    replaceVideo(target).play();
                }, true);
                vid.parentNode.replaceChild(target, vid);
                app.log("Cleaned deferred inline video: " + vidSrc);
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

    const fbclidFallback = /((?:[?&]|%3F|%26)fbclid=.*?)($|[?&]|%3F|%26)/ig;
    function stripFBCLID(node) {
        const trackedLinks = selectAllWithBase(node, `a[href*='fbclid='i]`);
        for (const a of trackedLinks) {
            const link = new URL(a.href);

            link.searchParams.delete("fbclid");
            if (a.href === link.href) {
                link.href = link.href.replace(fbclidFallback, "$2");
            }

            if (a.href === link.href) {
                app.log("Failed to remove fbclid from link:\n -> " + a);
            } else {
                a.href = link.href;
                applyStyle(a);
                app.log("Removed fbclid from link: " + a);
            }
        }
        return trackedLinks.length;
    }

    function stripRefs(node) {
        let intLinks = 0;

        function _strip(a) {
            if (a.nodeName !== "A" || !app.domains.some(d => a.hostname.endsWith(d)))
                return;

            ++intLinks;
            applyEventBlockers(a.parentNode);
            delete a.dataset.ft;

            const linkBase = a.origin + a.pathname;
            if (a.hasAttribute("href")) {
                const orig = a.getAttribute("href"); // get unexpanded value
                const href = cleanLinkParams(orig, linkBase); // Don't assign here to avoid infinite mutation recursion

                if (href != orig) {
                    a.href = href;
                    applyStyle(a);
                    app.log("Cleaned internal href:\n\t" + orig + "\n\t" + a.getAttribute("href"));
                }
            }

            if (a.hasAttribute("ajaxify")) {
                const orig = a.getAttribute("ajaxify");
                a.setAttribute("ajaxify", cleanLinkParams(orig, linkBase));
                if (orig != a.getAttribute("ajaxify")) {
                    applyStyle(a);
                    app.log("Cleaned internal ajaxify link:\n\t" + orig + "\n\t" + a.getAttribute("ajaxify"));
                }
            }

            if (a.dataset.hovercard) {
                delete a.dataset.hovercardReferrer;
                const orig = a.dataset.hovercard;
                a.dataset.hovercard = cleanLinkParams(orig, linkBase);
                if (orig != a.dataset.hovercard) {
                    applyStyle(a);
                    app.log("Cleaned internal hovercard link:\n\t" + orig + "\n\t" + a.dataset.hovercard);
                }
            }
        }

        _strip(node);
        for (const a of node.getElementsByTagName('a')) {
            _strip(a);
        }
        return intLinks;
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

        if (cleaned)
            applyEventBlockers(node);

        return cleaned;
    }

    /* END LINK TRACKING */

    /**
     * @param {Element} node
     * @param {Object} rule
     * @param {string} rule.selector
     * @param {Map<string,string>} rule.texts
     * @param {RegExp?} rule.patterns
     * @param {string} [method=app.options.hideMethod]
     */
    function removeArticles(node, { selector, texts, patterns }, method = app.options.hideMethod) {
        if (!selector)
            return;

        const getMatch = text => {
            if (texts.size === 0 && !patterns)
                return text;

            // Some sponsored have other details appended after a · (0xb7). Try matching both parts separately
            const parts = text.split("\xb7").map(s => s.trim().toLowerCase());

            if (patterns && parts.some(p => patterns.test(p)))
                return text;

            for (const p of parts) {
                const x = texts.get(normalizeString(p));
                if (x) return x;
            }
        };

        for (const e of selectAllWithBase(node, selector)) {
            const elementText = visibleText(e);

            const match = getMatch(elementText);
            if (match) {
                app.log(() => {
                    for (const s of selector.split(",")) {
                        if (e.matches(s)) {
                            return `>>> Rule matched for ${elementText}: ${selector} = ${s}`;
                        }
                    }
                });
                hide(e, match, method);
            }
        }
    }

    function removeAll(target) {
        removeArticles(target, _userRules);

        if (app.options.delSuggest)
            removeArticles(target, app.hide_rules.suggested);
        if (app.options.delPixeled)
            removeArticles(target, app.hide_rules.sponsored, document.location.pathname.startsWith("/marketplace") ? "remove" : app.options.hideMethod);
        if (app.options.pendingRules)
            removeArticles(target, app.hide_rules.pending);

        if (app.options.internalRefs)
            stripRefs(target);
    }

    let _running = false;
    function run(body) {
        if (_running)
            return;

        const SKIP = ["SCRIPT", "STYLE", "LINK"];
        const forEachAdded = (mutation, cb) => {
            for (const node of mutation.addedNodes) {
                if (node.nodeType == Node.ELEMENT_NODE && !SKIP.includes(node.nodeName) && !node.classList.contains(PROCESSED_CLASS)) {
                    cb(node);
                }
            }
        };

        new MutationObserver(async mutations => {
            for (const mutation of mutations) {
                if (mutation.type === "childList" && !SKIP.includes(mutation.target.nodeName)) {
                    const target = mutation.target;

                    removeAll(target);

                    if (app.options.fixLinks)
                        forEachAdded(mutation, removeLinkTracking);

                    forEachAdded(mutation, node => node.classList.add(PROCESSED_CLASS));
                } else if (mutation.target) {
                    if (app.options.fixLinks)
                        removeLinkTracking(mutation.target);
                    if (app.options.internalRefs)
                        stripRefs(mutation.target);
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
            removeAll(body);

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

    browser.runtime.onMessage.addListener(({ type, data }) => {
        switch (type) {
            // Fallback for old chrome based browsers that don't support tabs.removeCSS
            case "STYLE": {
                let styleElement = document.getElementById('fbtr-style');
                if (!styleElement) {
                    styleElement = document.createElement('style');
                    styleElement.id = 'fbtr-style';
                    document.head.append(styleElement);
                }

                if (styleElement.sheet.cssRules.length)
                    styleElement.sheet.deleteRule(0);

                if (data) {
                    // Timeout required for page to reparse
                    setTimeout(() => styleElement.sheet.insertRule(data), 50);
                }
                break;
            }
            case "HISTORY":
                if (!history.state.fbtr_clean) {
                    history.replaceState(Object.assign({ fbtr_clean: true }, history.state), "", data.clean);
                    app.log(`Cleaned link navigation done via history.pushState:\n\t${data.orig}\n\t${data.clean}`);
                }
                break;
        }
    });

    browser.runtime.sendMessage({ msg: "CSS", args: app.options });

}).catch(console.warn);
