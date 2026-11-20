#!/usr/bin/env bash
# Regenerates web/PWA icons from assets/icon.svg. Run after editing the SVG; commit the PNGs.
# (Native Android/iOS icons will be generated from the same SVG when those are set up.)
set -euo pipefail
cd "$(dirname "$0")/.."
for size in 192 512; do
  magick -background none -density 384 assets/icon.svg -resize ${size}x${size} public/icons/icon-${size}.png
done
magick -background none -density 384 assets/icon.svg -resize 180x180 public/icons/apple-touch-icon.png
cp assets/icon.svg public/icons/icon.svg
