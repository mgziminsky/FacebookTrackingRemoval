#!/bin/bash
set -x

cd $(dirname $0)

zip -r -ll Browser_Extension.zip . -i 'src/*' browser-polyfill.min.js manifest.json CHANGELOG LICENSE
