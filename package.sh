#!/bin/bash
set -x

cd $(dirname $0)

rm -f Browser_Extension.zip
cp webextension-polyfill/dist/browser-polyfill.min.js* ./
zip -r -ll Browser_Extension.zip . -i 'src/*' '_locales/*' browser-polyfill.min.js manifest.json CHANGELOG LICENSE
