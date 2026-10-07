#!/usr/bin/env sh
# Fails when a tracked text file contains a box-drawing character (U+2500 to U+257F).
set -eu

if git grep -n -I -P '[\x{2500}-\x{257F}]' -- .; then
  echo 'Box-drawing characters (U+2500 to U+257F) found in the files above.' >&2
  exit 1
fi
echo 'No box-drawing character found.'
