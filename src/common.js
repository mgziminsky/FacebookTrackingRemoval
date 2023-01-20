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

import { options } from "./config.js";

export {
    isChrome,
    log,
    warn,
};


const isChrome = Object.getPrototypeOf(browser) !== Object.prototype;

function log(arg) {
    if (options.logging)
        log_to(console.log, arg);
}
function warn(arg) {
    if (options.logging)
        log_to(console.warn, arg);
}

function log_to(logger, arg) {
    if (typeof (arg) === "function") {
        const res = arg();
        if (res)
            logger(res);
    } else {
        logger(arg);
    }
}
