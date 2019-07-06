#!/bin/bash
set -x

cd $(dirname $0)

rm -f Browser_Extension.zip
zip -r -ll Browser_Extension.zip . -i 'src/*' browser-polyfill.min.js manifest.json CHANGELOG LICENSE
