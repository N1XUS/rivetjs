#!/bin/sh
# Zero-cost gate: runtime + package (router/forms/i18n/kit/ui/motion/bridge, cdk masonry/flip/scheduler) bundle hashes and ssr-bench output must match
# the committed baselines, no production entry may bundle development code (dev-leaks.mjs), every conditional
# export must expose the same value names under each condition (condition-parity.mjs), and the compiler
# oracle must pass. `--update` rewrites the baselines (only for intended deltas).
set -e
root=$(cd "$(dirname "$0")/../.." && pwd)
dir="$root/scripts/zero-cost"
cd "$root"
# Per-run temp files: concurrent runs must not delete each other's output.
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
node "$dir/runtime-hashes.mjs" "$root" > "$tmp/runtime.now"
node "$dir/packages-hashes.mjs" "$root" > "$tmp/packages.now"
node apps/ssr-bench/build.ts > /dev/null
node "$dir/lanes-hashes.mjs" "$root/apps/ssr-bench/dist" > "$tmp/lanes.now"
if [ "$1" = "--update" ]; then
  cp "$tmp/runtime.now" "$dir/runtime.txt"; cp "$tmp/packages.now" "$dir/packages.txt"; cp "$tmp/lanes.now" "$dir/lanes.txt"; echo "baselines updated"
else
  status=0
  diff "$dir/runtime.txt" "$tmp/runtime.now" || status=1
  diff "$dir/packages.txt" "$tmp/packages.now" || status=1
  diff "$dir/lanes.txt" "$tmp/lanes.now" || status=1
  [ $status = 0 ] && echo "runtime + lanes: identical"
fi
node "$dir/dev-leaks.mjs" "$root" || status=1
node "$dir/condition-parity.mjs" "$root" || status=1
node libs/compiler/oracle/check.ts | tail -1
exit ${status:-0}
