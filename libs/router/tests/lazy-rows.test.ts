// `build/lazy-rows.ts`: the lazy collection rows `swap` harness (T1, measurement only) is reachable through
// `RIVET_LAZY_ROWS=swap` alone — dev server, or a build whose environment also carries the harness flag the
// measurement tools set — and then only rewrites the generated server entry.
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { LAZY_ROWS_ENV, LAZY_ROWS_HARNESS_ENV, lazyRowsHarness, lazyRowsMode, lazyRowsModule } from "../build/lazy-rows.ts";

test("lazyRowsMode: off without the env var; swap in dev or a harness build; a plain production build ignores it", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    assert.equal(lazyRowsMode("build", {}), null);
    // `on` / `off`: the runtime reads them at render (server lazy row records, T4); no build change, no warning.
    assert.equal(lazyRowsMode("serve", { [LAZY_ROWS_ENV]: "on" }), null);
    assert.equal(lazyRowsMode("build", { [LAZY_ROWS_ENV]: "off" }), null);
    assert.equal(lazyRowsMode("serve", { [LAZY_ROWS_ENV]: "swap" }), "swap");
    assert.equal(lazyRowsMode("build", { [LAZY_ROWS_ENV]: "swap", [LAZY_ROWS_HARNESS_ENV]: "1" }), "swap");
    assert.equal(lazyRowsMode("build", { [LAZY_ROWS_ENV]: "swap" }), null);
    assert.match(String(warn.mock.calls[0]?.[0]), /ignored/);
    assert.throws(() => lazyRowsMode("serve", { [LAZY_ROWS_ENV]: "lazy" }), /only measurement mode is "swap"/);
  } finally {
    warn.mockRestore();
  }
});

test("lazyRowsHarness: inert by default; in swap mode only the SSR server entry installs the row hook", () => {
  const entry = "/app/.rivet/entry.server.tsx";
  type Hooks = {
    config(config: object, env: { command: "serve" | "build" }): void;
    transform(code: string, id: string, options?: { ssr?: boolean }): { code: string } | null;
  };
  const off = lazyRowsHarness(() => entry) as unknown as Hooks;
  const saved = process.env[LAZY_ROWS_ENV];
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    delete process.env[LAZY_ROWS_ENV];
    off.config({}, { command: "build" });
    assert.equal(off.transform("x", entry, { ssr: true }), null);
    process.env[LAZY_ROWS_ENV] = "swap";
    const on = lazyRowsHarness(() => entry) as unknown as Hooks;
    on.config({}, { command: "serve" });
    assert.equal(on.transform("x", entry, {}), null);
    assert.equal(on.transform("x", "/app/src/page.tsx", { ssr: true }), null);
    const out = on.transform("export {};", entry + "?v=1", { ssr: true })!.code;
    assert.equal(out, `import { _lazyRowsSwap } from ${JSON.stringify(lazyRowsModule())};\n_lazyRowsSwap();\nexport {};`);
    assert.ok(existsSync(lazyRowsModule()));
  } finally {
    if (saved === undefined) delete process.env[LAZY_ROWS_ENV];
    else process.env[LAZY_ROWS_ENV] = saved;
    warn.mockRestore();
  }
});
