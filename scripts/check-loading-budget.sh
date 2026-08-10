#!/usr/bin/env bash
set -euo pipefail

index_file="site/index.html"
max_html_bytes=180000
first_render_budget=100000

html_bytes=$(wc -c < "$index_file" | tr -d ' ')
estimated_seconds=$(awk -v bytes="$html_bytes" 'BEGIN { printf "%.1f", bytes / 262144 }')

echo "homepage_html_bytes=$html_bytes"
echo "estimated_download_at_256KBps_seconds=$estimated_seconds"

if (( html_bytes > max_html_bytes )); then
  echo "FAIL: homepage HTML exceeds ${max_html_bytes} bytes"
  exit 1
fi

if rg -q '__bundler/manifest|Promise\.all\(uuids' "$index_file"; then
  echo "FAIL: homepage still performs client-side bundle unpacking"
  exit 1
fi

if ! head -c "$first_render_budget" "$index_file" | rg -q '天書難懂'; then
  echo "FAIL: homepage hero is not present in the first ${first_render_budget} bytes"
  exit 1
fi

echo "PASS: homepage meets the loading budget"
