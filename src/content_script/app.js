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

    Copyright (C) 2016-2023 Michael Ziminsky
*/

import { log } from "../common.js";
import { READY, hide_rules, initHideRule, onChanged, options } from "../config.js";
import { COLLAPSED_SELECTOR, MSG, PROCESSED_CLASS } from "../consts.js";
import { normalizeString, parseHideRules } from "../util.js";
import { applyStyle, cleanRedirectLinks, cleanShimLinks, fixGifs, fixVideoLinks, stripFBCLID, stripRefs } from "./cleaning.js";
import { applyEventBlockers, ariaText, buildCollapsible, inlineUse, selectAllWithBase, visibleText } from "./dom.js";


browser.runtime.sendMessage({ msg: MSG.actionEnable });


/**
 * @param {Element} elem
 * @param {string} label
 * @param {"remove" | "collapse"} method
 */
function hide(elem, label, method) {
    /** @type {Element} */
    let target;
    if (!(elem && (target = elem.closest(hide_rules.article_wrapper)))) {
        log(`Unable to hide ${label} - ${elem}`);
        return;
    }

    log(() => {
        const selector = hide_rules.article_wrapper;
        for (const s of selector.split(",")) {
            if (target.matches(s)) {
                return `>>> Wrapper matched for ${target.tagName}: ${selector} = ${s}`;
            }
        }
    });

    if (method === "collapse") {
        if (target.closest(COLLAPSED_SELECTOR)) {
            log(`${label} already collapsed`);
            return;
        }

        const wrapper = buildCollapsible(label);
        applyStyle(wrapper);
        for (const c of target.classList)
            wrapper.classList.add(c);

        target.parentNode.appendChild(wrapper);
        wrapper.appendChild(target);
        log(`Collapsed ${label}`);
    } else {
        // Removing breaks things :/ Consider using class instead of inline style?
        (target.closest(":not(:only-child)") || target).style = "display: none !important";
        log(`Removed ${label}`);
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

/**
 * @param {Element} node
 * @param {HideRule} rule
 * @param {"remove" | "collapse"} [method=options.hideMethod]
 */
function removeArticles(node, { selector, texts, patterns }, method = options.hideMethod) {
    if (!selector)
        return;

    /** @argument {string} text */
    const getMatch = text => {
        if (!(texts?.size || patterns))
            return text || "Unconditional Hide";

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
        const elementText = ariaText(e) || visibleText(e);

        const match = getMatch(elementText);
        if (match) {
            log(() => {
                for (const s of selector.split(",")) {
                    if (e.matches(s)) {
                        return `>>> Rule matched for ${elementText}: ${selector} = ${s}`;
                    }
                }
            });
            hide(e, match, method);
            e.classList.add(PROCESSED_CLASS);
        }
    }
}

function removeAll(target) {
    removeArticles(target, userRules);

    if (options.delSuggest)
        removeArticles(target, hide_rules.suggested);
    if (options.delPixeled) {
        removeArticles(target, { selector: hide_rules.unconditional }, "remove");
        removeArticles(target, hide_rules.sponsored, document.location.pathname.startsWith("/marketplace") ? "remove" : options.hideMethod);
    }
    if (options.pendingRules)
        removeArticles(target, hide_rules.pending);

    if (options.internalRefs)
        stripRefs(target);
}


/**
 * @param {MutationRecord} mutation
 * @param {(n: Node) => void} cb
 */
function forEachAdded(mutation, cb) {
    for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && !SKIP.includes(node.nodeName) && !node.classList.contains(PROCESSED_CLASS)) {
            cb(node);
        }
    }
}
const SKIP = ["SCRIPT", "STYLE", "LINK"];

const observer = new MutationObserver(async mutations => {
    for (const mutation of mutations) {
        if (mutation.type === "childList" && !SKIP.includes(mutation.target.nodeName)) {
            const target = mutation.target;
            inlineUse(target);

            removeAll(target);

            if (options.fixLinks)
                forEachAdded(mutation, removeLinkTracking);

            forEachAdded(mutation, node => node.classList.add(PROCESSED_CLASS));
        } else if (mutation.target) {
            if (options.fixLinks)
                removeLinkTracking(mutation.target);
            if (options.internalRefs)
                stripRefs(mutation.target);
        }
    }
});

let userRules;
async function run() {
    userRules = initHideRule(parseHideRules(options.userRules));
    const body = document.body;

    observer.disconnect();
    removeAll(body);

    observer.observe(body, (() => {
        const opts = { childList: true, subtree: true, characterData: false };
        if (options.fixLinks) {
            opts.attributes = true;
            opts.attributeFilter = ["href"];
        }
        return opts;
    })());

    if (options.fixLinks && removeLinkTracking(body) && document.getElementById("newsFeedHeading")) {
        const feed = document.getElementById("newsFeedHeading").parentNode;
        for (const stream of feed.querySelectorAll("div._4ikz")) {
            applyEventBlockers(stream);
        }
    }
}

/** @param {{type: string}} */
function handleMessage({ type, ...data }) {
    switch (type) {
        case MSG.history:
            if (!history.state.fbtr_clean) {
                history.replaceState(Object.assign({ fbtr_clean: true }, history.state), "", data.clean);
                log(`Cleaned link navigation done via history.pushState:\n\t${data.orig}\n\t${data.clean}`);
            }
            break;
    }
}

let activeStyle;
function start() {
    run();
    browser.runtime.onMessage.addListener(handleMessage);

    if (activeStyle)
        browser.runtime.sendMessage({ msg: MSG.removeCss, style: activeStyle });

    if (options.useStyle)
        browser.runtime.sendMessage({ msg: MSG.insertCss, style: activeStyle = options.modStyle });
}

function stop() {
    observer.disconnect();
    browser.runtime.onMessage.removeListener(handleMessage);
    browser.runtime.sendMessage({ msg: MSG.removeCss, style: activeStyle });
}

onChanged.addListener(() => options.enabled ? start() : stop());

READY.then(() => {
    if (options.enabled)
        start();
});
