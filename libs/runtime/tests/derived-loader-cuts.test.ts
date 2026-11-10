// HTMLBYTES (2026-11-10): the server ships the inline loader with the parts a page provably never runs cut
// (`server-derived.ts` `loaderCuts`, texts `DERIVED_LOADER_CUTS` from `build-loader.ts`): the cold-key hold without a
// record listening to `keydown`, the cold pointer capture without one listening to `pointerdown`, the `invalid` /
// `contextmenu` hold without either in `data-events`, the `data-g` match without `data-g`, the `data-boot` checks without
// `data-boot`, the hover hold + pruning of `data-fw="intent"` pages elsewhere. A page that listens keeps that part byte
// for byte. Compiled with the real derived server target.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { DERIVED_LOADER, DERIVED_LOADER_CUTS } from "../resume-loader-derived.min.ts";
import { applyCuts } from "../build-loader.ts";
import { importServer } from "./resume/compile.ts";

const compiled = hasDerivedModel() ? test : test.skip;
const KEYS = 1,
  CAPTURE = 2,
  MENU = 4,
  LINKS = 8,
  INTENT = 16,
  BOOT = 32;

async function page(handler: string, preload?: object): Promise<string> {
  const source = `import { signal } from "@rivetjs/reactivity";
export function Plain() {
  const n = signal(0);
  return <button id="b" ${handler}={() => n.set(n() + 1)}>{n()}</button>;
}
`;
  const out = compile(source, {
    target: "server",
    filename: "plain.tsx",
    resume: { module: "src/plain.tsx", boundaries: ["Plain"], independent: ["Plain"] },
  } as never);
  const { Plain } = await importServer<{ Plain: () => ServerValue }>(out.code);
  return (await derivedToString(() => Plain(), {
    manifest: { hash: "t", runtime: "/rt.js", symbols: { "src/plain.tsx#Plain": "/plain.js" } },
    preload,
  } as never)) as string;
}
const loader = (html: string): string => /<\/script><script>([\s\S]*?)<\/script>/.exec(html)![1]!;

test("every cut text is in the plain loader once; any cut set leaves a parseable loader", () => {
  for (const pairs of DERIVED_LOADER_CUTS) for (const [text] of pairs) assert.equal(DERIVED_LOADER.split(text).length, 2, text);
  for (let cut = 0; cut < 64; cut++) new Function(applyCuts(DERIVED_LOADER, DERIVED_LOADER_CUTS, cut));
  assert.ok(!applyCuts(DERIVED_LOADER, DERIVED_LOADER_CUTS, 63).match(/data-rk|data-rv-capture|data-cm|dataset\.g|data-boot|"intent"|\(over\|enter\)/));
});

compiled("a click-only page ships the loader with every part it never runs cut; an intent page keeps its hover hold", async () => {
  const idle = await page("onClick");
  assert.doesNotMatch(idle, / data-fw=/);
  assert.equal(loader(idle), applyCuts(DERIVED_LOADER, DERIVED_LOADER_CUTS, KEYS | CAPTURE | MENU | LINKS | INTENT | BOOT));
  const intent = await page("onClick", { lean: true });
  assert.match(intent, / data-fw="intent"/);
  assert.equal(loader(intent), applyCuts(DERIVED_LOADER, DERIVED_LOADER_CUTS, KEYS | CAPTURE | MENU | LINKS | BOOT));
});

compiled("a page listening to keydown / pointerdown / contextmenu keeps the cold hold for that type", async () => {
  assert.equal(loader(await page("onKeyDown")), applyCuts(DERIVED_LOADER, DERIVED_LOADER_CUTS, CAPTURE | MENU | LINKS | INTENT | BOOT));
  assert.equal(loader(await page("onPointerDown")), applyCuts(DERIVED_LOADER, DERIVED_LOADER_CUTS, KEYS | MENU | LINKS | INTENT | BOOT));
  const menu = await page("onContextMenu");
  assert.match(menu, / data-events="[^"]*contextmenu/);
  assert.equal(loader(menu), applyCuts(DERIVED_LOADER, DERIVED_LOADER_CUTS, KEYS | CAPTURE | LINKS | INTENT | BOOT));
});
