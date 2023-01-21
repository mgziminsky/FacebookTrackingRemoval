/**
 * Copyright (C) 2023 Michael Ziminsky (Z)
 *
 * This file is part of FacebookTrackingRemoval.
 *
 * FacebookTrackingRemoval is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * FacebookTrackingRemoval is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with FacebookTrackingRemoval.  If not, see <http://www.gnu.org/licenses/>.
 */

import { log } from "../common.js";
import { domains, options } from "../config.js";
import { STYLE_CLASS } from "../consts.js";
import { cleanLinkParams } from "../util.js";
import { applyEventBlockers, cleanAttrs, selectAllWithBase, stopPropagation } from "./dom.js";

export {
    applyStyle,
    cleanShimLinks,
    cleanRedirectLinks,
    fixGifs,
    fixVideoLinks,
    stripFBCLID,
    stripRefs,
};


function applyStyle(elem) {
    elem.classList.add(STYLE_CLASS);
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
            log("Unsupported link protocol; leaving unchanged: " + href);
    } catch (_) {
        log("Link cleaning encountered an invalid url: " + href);
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

// Desktop only
function cleanShimLinks(node) {
    const trackedLinks = selectAllWithBase(node, "a[onclick^='LinkshimAsyncLink.referrer_log']");
    for (const a of trackedLinks) {
        cleanLink(a, extractQuotedString(a.getAttribute("onmouseover")).replace(/\\(.)/g, '$1'));
        log("Removed tracking from shim link: " + a);
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

        if (options.inlineVids) {
            log("Inlined video: " + replaceVideo(vid).src);
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
            log("Cleaned deferred inline video: " + vidSrc);
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
        log("Removed tracking from redirect link: " + a);
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
            log("Failed to remove fbclid from link:\n -> " + a);
        } else {
            a.href = link.href;
            applyStyle(a);
            log("Removed fbclid from link: " + a);
        }
    }
    return trackedLinks.length;
}

function stripRefs(node) {
    let intLinks = 0;

    function _strip(a) {
        if (a.nodeName !== "A" || !domains.some(d => a.hostname.endsWith(d)))
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
                log("Cleaned internal href:\n\t" + orig + "\n\t" + a.getAttribute("href"));
            }
        }

        if (a.hasAttribute("ajaxify")) {
            const orig = a.getAttribute("ajaxify");
            a.setAttribute("ajaxify", cleanLinkParams(orig, linkBase));
            if (orig != a.getAttribute("ajaxify")) {
                applyStyle(a);
                log("Cleaned internal ajaxify link:\n\t" + orig + "\n\t" + a.getAttribute("ajaxify"));
            }
        }

        if (a.dataset.hovercard) {
            delete a.dataset.hovercardReferrer;
            const orig = a.dataset.hovercard;
            a.dataset.hovercard = cleanLinkParams(orig, linkBase);
            if (orig != a.dataset.hovercard) {
                applyStyle(a);
                log("Cleaned internal hovercard link:\n\t" + orig + "\n\t" + a.dataset.hovercard);
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
        log("Fixed GIF: " + gif.dataset.src);
    }
}

/** @param {string} s */
function extractQuotedString(s) {
    return s.substring(s.indexOf('"') + 1, s.lastIndexOf('"'));
}
