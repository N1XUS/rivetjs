#!/usr/bin/env bash
# Build the compiler WebAssembly module in Docker (no host Rust toolchain) and copy it next to the
# loader as libs/compiler/rivet_compiler.wasm. Cargo registry and target dirs live in named volumes
# (override with RIVET_CARGO_VOLUME / RIVET_TARGET_VOLUME / RIVET_RUSTUP_VOLUME).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
image="${RIVET_RUST_IMAGE:-rust:1.85.1-bookworm}"
# Use an invocation-owned path so Docker never reuses an intermediate filename moved by a
# previous build. A unique directory also prevents separate invocations sharing an output.
build_tmp="$(mktemp -d "$here/.rivet-compiler.XXXXXX")"
output="$build_tmp/rivet_compiler.wasm"
trap 'rm -f -- "$output"; rmdir -- "$build_tmp"' EXIT
docker run --rm \
  -v "${RIVET_CARGO_VOLUME:-rivet-cargo}":/usr/local/cargo/registry \
  -v "${RIVET_TARGET_VOLUME:-rivet-target}":/target \
  -v "${RIVET_RUSTUP_VOLUME:-rivet-rustup}":/usr/local/rustup \
  -v "$here":/src \
  -w /src \
  -e CARGO_TARGET_DIR=/target \
  -e RIVET_WASM_OUTPUT="/src/${build_tmp##*/}/rivet_compiler.wasm" \
  "$image" \
  bash -c '
    set -euo pipefail
    rustup target list --installed | grep -q wasm32-unknown-unknown || rustup target add wasm32-unknown-unknown >/dev/null
    # Staleness guard (X2): sha256 over the sha256sum manifest of Cargo.toml, Cargo.lock, .cargo/config.toml and src/**
    # (sorted paths), exported as `source_hash_ptr/len`; tests/wasm-fresh.test.ts recomputes it.
    export RIVET_SOURCE_HASH="$( { echo Cargo.toml; echo Cargo.lock; echo .cargo/config.toml; find src -type f; } | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -d" " -f1)"
    cargo build --release --locked --target wasm32-unknown-unknown "$@"
    out=/target/wasm32-unknown-unknown/release/rivet_compiler.wasm
    if command -v wasm-opt >/dev/null; then wasm-opt -O3 "$out" -o "$RIVET_WASM_OUTPUT"; else cp "$out" "$RIVET_WASM_OUTPUT"; fi
  ' bash "$@"
mv "$output" "$here/../rivet_compiler.wasm"
ls -l "$here/../rivet_compiler.wasm"
