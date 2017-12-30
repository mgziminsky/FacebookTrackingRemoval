#!/bin/sh
cd $(dirname $0)
zip -r -ll extension.zip . -i 'src/*' -i browser-polyfill.min.js -i manifest.json -i CHANGELOG
