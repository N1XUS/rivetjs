// scripts/format-check.ts: only changed files whose base version is prettier-clean are checked.
import { strict as assert } from "node:assert";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, test } from "vitest";

const script = fileURLToPath(new URL("../format-check.ts", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "format-check-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
const run = (...args: string[]) => spawnSync(process.execPath, [script, "--base", "HEAD", ...args], { cwd: dir, encoding: "utf8" });
const CLEAN = "export const a = 1;\n";
const DIRTY = "export const a   =   1\n";

test("checks changed + new files that were clean at the base, skips files already unformatted there, --write fixes", () => {
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  writeFileSync(join(dir, ".prettierrc.json"), '{ "printWidth": 160 }\n');
  writeFileSync(join(dir, ".prettierignore"), "gen.ts\n");
  writeFileSync(join(dir, "clean.ts"), CLEAN);
  writeFileSync(join(dir, "legacy.ts"), DIRTY);
  writeFileSync(join(dir, "untouched.ts"), DIRTY);
  git("add", ".");
  git("commit", "-qm", "base");

  writeFileSync(join(dir, "clean.ts"), DIRTY); // was clean: now checked and fails
  writeFileSync(join(dir, "legacy.ts"), DIRTY + DIRTY); // unformatted at the base: skipped
  writeFileSync(join(dir, "new.ts"), DIRTY); // new file: checked
  writeFileSync(join(dir, "fine.ts"), CLEAN); // new and formatted
  writeFileSync(join(dir, "gen.ts"), DIRTY); // ignored
  writeFileSync(join(dir, "notes.md"), "#   not checked\n"); // not a TS/JS/JSON file

  const failing = run();
  assert.equal(failing.status, 1, failing.stdout + failing.stderr);
  assert.match(failing.stderr, /not formatted:\n {2}clean\.ts\n {2}new\.ts\n/);
  assert.match(failing.stdout, /skipped \(not prettier-clean at [0-9a-f]{8}\): 1\n {2}legacy\.ts/);
  assert.match(failing.stdout, /format: 3 changed file\(s\) checked, 2 unformatted, 1 skipped/);

  const fixing = run("--write");
  assert.equal(fixing.status, 0, fixing.stdout + fixing.stderr);
  assert.equal(readFileSync(join(dir, "clean.ts"), "utf8"), CLEAN);
  assert.equal(readFileSync(join(dir, "new.ts"), "utf8"), CLEAN);
  assert.equal(readFileSync(join(dir, "legacy.ts"), "utf8"), DIRTY + DIRTY, "never reformats a file that was unformatted at the base");
  assert.equal(readFileSync(join(dir, "gen.ts"), "utf8"), DIRTY);

  const passing = run();
  assert.equal(passing.status, 0, passing.stdout + passing.stderr);
  // clean.ts is back to its base content, so it is no longer a change.
  assert.match(passing.stdout, /format: 2 changed file\(s\) checked, 0 unformatted, 1 skipped/);
});

test("unparsable files are listed as skipped, not a crash; real diffs still fail", () => {
  writeFileSync(join(dir, "broken.ts"), "export const = ;\n"); // new + unparsable: skipped
  writeFileSync(join(dir, "other.ts"), DIRTY); // new + unformatted: still fails
  const result = run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /skipped \(prettier cannot parse\): 1\n {2}broken\.ts: /);
  assert.match(result.stderr, /not formatted:\n {2}other\.ts\n/);
  assert.doesNotMatch(result.stderr, /broken\.ts/);

  writeFileSync(join(dir, "other.ts"), CLEAN);
  const passing = run();
  assert.equal(passing.status, 0, passing.stdout + passing.stderr);
  assert.match(passing.stdout, /skipped \(prettier cannot parse\): 1/);
});
