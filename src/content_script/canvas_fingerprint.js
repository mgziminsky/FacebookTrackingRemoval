/**
 * Copyright (C) 2024 Michael Ziminsky (Z)
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
import { MAX_CANVAS_SENSITIVITY, hide_rules, options } from "../config.js";

export { computeCanvasPrints, testCanvas };

/** @type {Map<string, [number]>} */
const canvasPrints = new Map();

/**
 * Measures the "empty" spaces between the first and last "opaque" pixels of a 1D, 1-pixel high row of a rendered canvas
 * @param {Uint8ClampedArray} data An array of pixels for a singal row from a canvas rendering context
 * as retured by `ctx.getImageData(x, y, ctx.canvas.width, 1)`
 */
function gaps(data) {
    const ALPHA = 180; // somewhat arbitrary based on some manual checks
    const start = data.findIndex((n, i) => n >= ALPHA && !((i + 1) % 4));
    if (start < 0) throw "Empty data";
    const end = data.findLastIndex((n, i) => n >= ALPHA && !((i + 1) % 4));

    const fprint = [];
    for (let i = start, gap = 0, empty = false; i <= end; i += 4) {
        const val = data[i];
        if (empty !== val < ALPHA) {
            if (empty) fprint.push(gap);
            empty = !empty;
            gap = 0;
        }
        ++gap;
    }
    return fprint;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} [txt]
 */
function fingerprintCanvas(ctx, txt) {
    const mid = ctx.canvas.height / 2;
    const off = ctx.measureText("").alphabeticBaseline / 2;
    if (txt) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillText(txt, 0, mid);
    }
    const slice = ctx.getImageData(0, mid - off, ctx.canvas.width, 1).data;
    return gaps(slice);
}

/**
 * @param {Iterable<string>} texts
 * @param {Element} [ref=document.body]
 */
async function computeCanvasPrints(texts, ref) {
    canvasPrints.clear();
    const ctx = new OffscreenCanvas(300, 50).getContext("2d", { willReadFrequently: true });
    const style = getComputedStyle(ref ?? document.body);
    ctx.font = style.font;
    ctx.fillStyle = style.color;
    ctx.textBaseline = "middle";

    for (const text of texts) {
        const fprint = fingerprintCanvas(ctx, text);
        if (fprint) canvasPrints.set(text, fprint);
    }
}

/**
 * Check if the canvas context matches one of the recognized fingerprints
 * as calculated by {@link computeCanvasPrints}
 * @param {CanvasRenderingContext2D} ctx
 */
function testCanvas(ctx) {
    const fprint = fingerprintCanvas(ctx);
    if (!fprint) return;

    /** @type {[number, string][]} */
    let matches = [];
    for (const [txt, print] of canvasPrints.entries()) {
        if (fprint.length !== print.length) continue;
        let sumSq = 0;
        for (let i = 0; i < print.length; i++) {
            const diff = Math.abs(fprint[i] - print[i]);
            sumSq += diff * diff;
        }
        const stdDev = Math.sqrt(sumSq / fprint.length);
        if (stdDev < Number.EPSILON) {
            matches = [[0, txt]];
            break;
        }
        if (stdDev < MAX_CANVAS_SENSITIVITY - options.canvasSensitivity) {
            matches.push([stdDev, txt]);
        }
    }
    if (matches.length) {
        const [stdDev, txt] = matches.reduce((min, match) => (match < min ? match : min));
        log(() => `Canvas matched fingerprint for "${txt}": ${stdDev}`);
        return txt;
    }
}
