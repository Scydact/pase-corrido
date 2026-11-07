#!/usr/bin/env bash
# Compiles a small OpenCV.js with only the functions the app uses, into vendor/opencv.
# Separate from `npm run build` because it downloads a compiler and takes minutes. It's only
# needed when scripts/opencv_js.config.py or the versions below change.
set -euo pipefail

OPENCV_VERSION=4.13.0
EMSDK_VERSION=4.0.20

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$root/.opencv-build"
mkdir -p "$work"
cd "$work"

[ -d opencv ] || git clone --depth 1 --branch "$OPENCV_VERSION" https://github.com/opencv/opencv.git
[ -d emsdk ] || git clone --depth 1 https://github.com/emscripten-core/emsdk.git

./emsdk/emsdk install "$EMSDK_VERSION"
./emsdk/emsdk activate "$EMSDK_VERSION"
# shellcheck disable=SC1091
source ./emsdk/emsdk_env.sh

# C++17 is what Embind requires from Emscripten 4.0.20 on, per OpenCV's build docs.
rm -rf build
emcmake python3 opencv/platforms/js/build_js.py build \
  --build_wasm \
  --config "$root/scripts/opencv_js.config.py" \
  --cmake_option="-DCMAKE_CXX_STANDARD=17" \
  --cmake_option="-DBUILD_opencv_calib3d=OFF" \
  --cmake_option="-DBUILD_opencv_dnn=OFF" \
  --cmake_option="-DBUILD_opencv_features2d=OFF" \
  --cmake_option="-DBUILD_opencv_flann=OFF" \
  --cmake_option="-DBUILD_opencv_objdetect=OFF" \
  --cmake_option="-DBUILD_opencv_photo=OFF" \
  --cmake_option="-DBUILD_opencv_video=OFF"

mkdir -p "$root/vendor/opencv"
cp build/bin/opencv.js "$root/vendor/opencv/opencv.js"
ls -la "$root/vendor/opencv"
