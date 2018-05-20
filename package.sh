#!/bin/bash
set -x

cd $(dirname $0)

zip -r -ll Firefox_Extension.zip . -i 'src/*' browser-polyfill.min.js manifest.json CHANGELOG LICENSE

tempDir=`mktemp -d`
trap "rm -rf $tempDir" EXIT

cp Firefox_Extension.zip Chrome_Extension.zip
chromePath="$(pwd)/Chrome_Extension.zip"

sed -E '/"name":/s;(Facebook\S*) ([^"]+);\2 for \1;' manifest.json > "$tempDir/manifest.json"
cd "$tempDir"
zip -f -ll "$chromePath" manifest.json
