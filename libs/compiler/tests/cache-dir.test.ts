// `rivetCacheDir()`: the default build-cache root is per user and private (cached entries are spliced into output).
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rivetCacheDir } from "../cache-dir.ts";

const saved = { cache: process.env.RIVET_CACHE_DIR, tmp: process.env.TMPDIR };
const made: string[] = [];
afterEach(() => {
  for (const [key, value] of [
    ["RIVET_CACHE_DIR", saved.cache],
    ["TMPDIR", saved.tmp],
  ] as const)
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "rivet-cache-dir-test-"));
  made.push(dir);
  delete process.env.RIVET_CACHE_DIR;
  process.env.TMPDIR = dir;
  return dir;
};

test("RIVET_CACHE_DIR wins as given", () => {
  process.env.RIVET_CACHE_DIR = "/somewhere/else";
  assert.equal(rivetCacheDir(), "/somewhere/else");
});

test.skipIf(!process.getuid)("default root: per user, created private", () => {
  const tmp = fresh();
  const dir = rivetCacheDir();
  assert.equal(dir, join(tmp, "rivet-cache-" + process.getuid!()));
  assert.equal(statSync(dir).mode & 0o777, 0o700);
});

test.skipIf(!process.getuid)("default root writable by others is refused (shared /tmp cache poisoning)", () => {
  const tmp = fresh();
  const dir = join(tmp, "rivet-cache-" + process.getuid!());
  mkdirSync(dir);
  chmodSync(dir, 0o777);
  assert.throws(() => rivetCacheDir(), /owned by another user or writable by others/);
});
