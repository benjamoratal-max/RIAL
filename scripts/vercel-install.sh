#!/usr/bin/env bash
set -euo pipefail
if [ -f long-term-rentals/package.json ]; then
  cd long-term-rentals
fi
npm ci
