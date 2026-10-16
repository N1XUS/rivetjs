// T13 server behaviour: the primitives are inert on the server (no window): accessors read 0 / false, `animate`
// throws the dev error naming where to call it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { prefersReducedMotion } from "../reduced-motion.ts";
import { animate } from "../animate.ts";

test("prefersReducedMotion() on the server: false", () => {
  assert.equal(prefersReducedMotion()(), false);
});

test("animate on the server: inert controls in production (development builds throw the dev error)", async () => {
  const controls = animate("#x", { opacity: 1 });
  await controls;
});

// Isolation (esbuild, `motion` bundled, Rivet packages external): `/in-view` alone carries Motion's `inView` only.
test("/in-view alone pulls no scroll / animate code; /reduced-motion no motion at all", async () => {
  const { build } = await import("esbuild");
  const size = async (contents: string) =>
    (
      await build({
        stdin: { contents, resolveDir: new URL("../", import.meta.url).pathname, loader: "tsx" },
        bundle: true,
        write: false,
        minify: true,
        format: "esm",
        platform: "browser",
        conditions: ["browser", "production"],
        logLevel: "error",
        external: ["@rivetjs/*"],
      })
    ).outputFiles[0]!.contents.length;
  const inView = await size('export { createInView } from "./in-view.tsx";');
  const scroll = await size('export { createScroll } from "./scroll.tsx";');
  assert.ok(inView < 2000, `in-view ${inView} B min`);
  assert.ok(scroll > 4 * inView, `scroll ${scroll} B min vs in-view ${inView}`);
  assert.ok((await size('export { prefersReducedMotion } from "./reduced-motion.ts";')) < 500);
});
