// X2: the committed wasm must be built from the committed Rust sources. `rust/build.sh` embeds
// sha256(sha256sum manifest of Cargo.toml, Cargo.lock, .cargo/config.toml, src/** in sorted path order); a Rust edit
// without a rebuild (or a wasm from another tree) fails here.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { wasmSourceHash } from "../wasm.ts";

const crate = new URL("../rust/", import.meta.url).pathname;
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [relative(crate, join(dir, e.name))]));
const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

test("rivet_compiler.wasm is built from the current rust/ sources (run rust/build.sh)", () => {
  // `LC_ALL=C sort` order = byte order of the path strings.
  const paths = ["Cargo.toml", "Cargo.lock", ".cargo/config.toml", ...files(join(crate, "src"))].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  const manifest = paths.map((p) => `${sha(readFileSync(join(crate, p)))}  ${p}\n`).join("");
  assert.equal(wasmSourceHash(), sha(manifest));
});
