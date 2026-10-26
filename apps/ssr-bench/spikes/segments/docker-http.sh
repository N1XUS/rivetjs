#!/usr/bin/env bash
# Lane ZERO SEGMENTS: http.mjs inside the Node 26 image with gRPC data (GRPC = a dependency-free gRPC content server
# printing "PORT <n>", e.g. lane NATIVE's apps/ssr-bench/spikes/native/grpc-lite.mjs).
# usage (host): docker run --rm -v $PWD:$PWD -w $PWD -e GRPC=<server.mjs> node:26.11.1-bookworm-slim \
#   bash apps/ssr-bench/spikes/segments/docker-http.sh $PWD <secs> <rounds> <conc> <rows,…> <name=dist>…
set -euo pipefail
root=$1
shift
node "$GRPC" > /tmp/grpc.log 2>&1 &
until grep -q PORT /tmp/grpc.log 2>/dev/null; do sleep 0.1; done
export GRPC_URL="127.0.0.1:$(sed -n 's/PORT //p' /tmp/grpc.log)"
node "$root/apps/ssr-bench/spikes/segments/http.mjs" "$root" "$@"
