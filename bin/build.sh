#!/bin/bash

ELECTRON_VERSION=0.36.9
PACKAGE_VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | xargs)
ROOT_DIR=$(cd $(dirname $0)/..; pwd)

cd $ROOT_DIR
rm -rf dist
mkdir -p dist
NODE_ENV=production webpack
sed -i '' -e 's/http:\/\/localhost:3000\///g' dist/index.html
cp -r assets/images/*.ico assets/images/*.icns .babelrc package.json index.js main.js main dist/

cd dist
npm install --production

electron-packager ./ KETAKA-Lite --platform=win32 --arch=ia32 --version="${ELECTRON_VERSION}" --app-version="${PACKAGE_VERSION}" --icon=treasure_logo.ico
zip -r "KETAKA-Lite-win32-ia32-v${PACKAGE_VERSION}.zip" KETAKA-Lite-win32-ia32
rm -rf KETAKA-Lite-win32-ia32*

electron-packager ./ KETAKA-Lite --platform=win32 --arch=x64 --version="${ELECTRON_VERSION}" --app-version="${PACKAGE_VERSION}" --icon=treasure_logo.ico
zip -r "KETAKA-Lite-win32-x64-v${PACKAGE_VERSION}.zip" KETAKA-Lite-win32-x64
rm -rf KETAKA-Lite-win32-x64*

electron-packager ./ KETAKA-Lite --platform=darwin --arch=x64 --version="${ELECTRON_VERSION}" --app-version="${PACKAGE_VERSION}" --icon=treasure_logo.icns
zip -r "KETAKA-Lite-darwin-x64-v${PACKAGE_VERSION}.zip" KETAKA-Lite-darwin-x64
rm -rf KETAKA-Lite-darwin-x64
