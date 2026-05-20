#!/usr/bin/env bash
set -euo pipefail
if [ -f long-term-rentals/package.json ]; then
  cd long-term-rentals
  npm run build
else
  npm run build
  mkdir -p long-term-rentals
  rm -rf long-term-rentals/dist
  cp -r dist long-term-rentals/dist
fi
