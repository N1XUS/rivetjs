// The DOM runtime under Vite's module runner (what a generated app's Vitest `dom` project and SSR dev use), entered
// through `dom.ts` / `dev/dom.ts` first: `dom.ts` ↔ `dom-v2.ts` is an import cycle, and the runner defines a module's
// `export … from` bindings only when its body reaches them. A `dom-v2.ts` top-level read of a binding re-exported by
// `dom.ts` was undefined there ("Construct DOM inside mount(): no document" in every generated app's component test,
// NX-E2E 2026-10-27). The repo's own suites import natively (`viteModuleRunner: false`), where the cycle is harmless.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { createServer } from "vite";

const RUNTIME = resolve(import.meta.dirname, "..");

for (const entry of ["dom.ts", "dev/dom.ts"]) {
  test(`module runner, ${entry} first: a template clones inside mount()`, async () => {
    const server = await createServer({
      root: RUNTIME,
      configFile: false,
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "custom",
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const dom = (await server.ssrLoadModule(resolve(RUNTIME, entry))) as typeof import("../dom.ts");
      const v2 = (await server.ssrLoadModule(resolve(RUNTIME, "dom-v2.ts"))) as typeof import("../dom-v2.ts");
      const window = new Window({ url: "http://localhost/" });
      const host = window.document.createElement("div") as unknown as Element;
      const tpl = v2._tpl("<b>ok</b>");
      dom.mount(() => tpl() as never, host);
      assert.equal(host.innerHTML, "<b>ok</b>");
      await window.happyDOM.close();
    } finally {
      await server.close();
    }
  });
}
