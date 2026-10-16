// The cdk server slot probe (`collections/server-on.tsx`) is selected by export conditions: `browser` → the empty
// `server-off.ts`, everything else (node, workerd without `browser`, …) → the probe. Real Node resolution in a child process
// (`-C <condition>`), plus the dev warning a server bundle that resolves `browser` gets (once; `browser` + `development` →
// `server-dev.ts`). `server-off.ts` imports nothing: a `#dev` import there added a shared chunk to every page.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const run = (conditions: string[], code: string): string =>
  execFileSync(process.execPath, [...conditions.flatMap((c) => ["-C", c]), "--input-type=module", "-e", code], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const resolved = (conditions: string[]): string => run(conditions, 'console.log(import.meta.resolve("@rivetjs/cdk/slot-probe"))').trim();

test("slot-probe: node resolves the probe, browser the empty module", () => {
  assert.match(resolved([]), /collections\/server-on\.tsx$/);
  assert.match(resolved(["node"]), /collections\/server-on\.tsx$/);
  assert.match(resolved(["browser"]), /collections\/server-off\.ts$/);
  assert.match(resolved(["browser", "development"]), /collections\/server-dev\.ts$/);
});

test("slot-probe: the package `#server` import maps like the public subpath", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    imports: Record<string, unknown>;
    exports: Record<string, unknown>;
  };
  assert.deepEqual(pkg.imports["#server"], pkg.exports["./slot-probe"]);
});

test("slot-probe: a server that resolves `browser` warns once in development, never in production", () => {
  const code =
    'const w = []; console.warn = (m) => w.push(m); const m = await import("@rivetjs/cdk/slot-probe"); m.probeSlots([], null); m.probeSlots([], null); console.log(JSON.stringify({ probing: m.slotProbing, w }))';
  const dev = JSON.parse(run(["browser", "development"], code)) as { probing: boolean; w: string[] };
  assert.equal(dev.probing, false);
  assert.equal(dev.w.length, 1);
  assert.match(dev.w[0]!, /cdk slot probe is disabled: your server bundle resolves the `browser` export condition/);
  const prod = JSON.parse(run(["browser"], code)) as { w: string[] };
  assert.deepEqual(prod.w, []);
});
