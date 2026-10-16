// `_rPreload` (bridge ABI): framework-island chunks registered with the preload planner.
import { readable } from "./resume/wire.ts";
import { test, vi } from "vitest";
import assert from "node:assert/strict";
import { resumableToString, _rPreload, _renderNonce } from "@rivetjs/runtime/server-resume";
import { renderToString } from "@rivetjs/runtime/server";
import { compileResume, importServer } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";

const DEV_RUN = process.execArgv.includes("--conditions=development");
type PlanEntry = [string, string, number[]?];
type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Strategy = Parameters<typeof _rPreload>[1];
interface Props {
  url: string;
  strategy: Strategy;
  ids?: number[];
}
type ManifestExtra = Partial<ResumeManifest> & {
  lazy?: Record<string, string[]>;
  sizes?: Record<string, number>;
  deps?: Record<string, string[]>;
};

// A click handler makes the page resumable (intent-class: it schedules nothing itself).
const source = `
import { signal } from "@rivetjs/reactivity";
import { _rPreload } from "@rivetjs/runtime/server-resume";
export function Island({ url, strategy, ids }) {
  const n = signal(0);
  _rPreload(url, strategy, ids);
  return <button onClick={() => n.set(n() + 1)}>{n()}</button>;
}
`;
// No other resumable record: `_rPreload` alone must not make the page resumable (static pages ship zero JS).
const staticSource = `
import { _rPreload } from "@rivetjs/runtime/server-resume";
export function Static({ url }) {
  _rPreload(url, "eager");
  return <p>static</p>;
}
`;
const staticMod = await importServer<{ Static: (props: { url: string }) => ServerValue }>(compileResume(staticSource, "server").code);
const symbols = compileResume(source, "dom").symbols;
const mod = await importServer<{ Island: (props: Props) => ServerValue }>(compileResume(source, "server").code);
const manifestOf = (extra: ManifestExtra = {}): ResumeManifest =>
  ({
    runtime: "/rt.js",
    symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
    lazy: { "/c/Island.js": ["/c/react-island.js"] },
    ...extra,
  }) as ResumeManifest;
const ISLAND = "/c/react-island.js";
const render = (props: Props, extra?: ManifestExtra, options: { preload?: { background: number } } = {}) =>
  resumableToString(() => mod.Island(props), { manifest: manifestOf(extra), ...options });
const scheduleOf = (html: string): PlanEntry[] | null => {
  const attr = /data-preload="([^"]*)"/.exec(html)?.[1];
  return attr ? (JSON.parse(attr.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as PlanEntry[]) : null;
};
const entryOf = (html: string, url = ISLAND) =>
  scheduleOf(html)
    ?.slice(1)
    .find(([u]) => u === url);
const stateOf = (html: string): { c: string[]; x?: number[] } =>
  readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) as { c: string[]; x?: number[] };

test("_rPreload: each strategy plans like a symbol of that chunk (e / i / v; intent and interaction schedule nothing)", async () => {
  assert.deepEqual(entryOf(await render({ url: ISLAND, strategy: "eager" })), [ISLAND, "e"]);
  assert.deepEqual(entryOf(await render({ url: ISLAND, strategy: "idle" })), [ISLAND, "i"]);
  // Visible: viewport-only without known sizes, observing the given element ids.
  assert.deepEqual(entryOf(await render({ url: ISLAND, strategy: "visible", ids: [7, 9] })), [ISLAND, "v", [7, 9]]);
  assert.equal(entryOf(await render({ url: ISLAND, strategy: "intent" })), undefined);
  assert.equal(entryOf(await render({ url: ISLAND, strategy: "interaction" })), undefined);
});

test("_rPreload: the shipped chunk list (state c) is untouched; interaction (state x) lists shipped chunks only", async () => {
  const html = await render({ url: ISLAND, strategy: "interaction" });
  const state = stateOf(html);
  assert.ok(!state.c.includes(ISLAND));
  assert.equal(state.x, undefined);
  assert.ok(!stateOf(await render({ url: ISLAND, strategy: "eager" })).c.includes(ISLAND));
});

test("_rPreload: background budget counts the chunk's closure; over VISIBLE_MAX waits for intent", async () => {
  const deps = { [ISLAND]: ["/c/react-dom.js"] };
  const sizes = { "/c/Island.js": 1_000, [ISLAND]: 4_000, "/c/react-dom.js": 190_000 };
  const visible = { url: ISLAND, strategy: "visible" as const, ids: [1] };
  // Default budget (1 MiB): the 194 KB closure fits → background prefetch.
  assert.equal(entryOf(await render(visible, { sizes, deps }))![1], "P");
  // 128 KB budget: the closure (own 4 KB + 190 KB react-dom) does not fit → viewport-only.
  assert.deepEqual(entryOf(await render(visible, { sizes, deps }, { preload: { background: 128 * 1024 } })), [ISLAND, "v", [1]]);
  // The runtime already brings react-dom: only the 4 KB counts.
  assert.equal(entryOf(await render(visible, { sizes, deps: { ...deps, "/rt.js": ["/c/react-dom.js"] } }, { preload: { background: 128 * 1024 } }))![1], "P");
  // Over VISIBLE_MAX (8 KB) a visible registration waits for intent.
  assert.equal(entryOf(await render(visible, { sizes: { ...sizes, [ISLAND]: 64_000 }, deps })), undefined);
  // Lazy imports of the registered chunk follow at idle.
  assert.deepEqual(
    entryOf(await render({ url: ISLAND, strategy: "eager" }, { lazy: { "/c/Island.js": [ISLAND], [ISLAND]: ["/c/later.js"] } }), "/c/later.js"),
    ["/c/later.js", "i"],
  );
});

test("_rPreload: a key unknown to a build manifest warns in dev (prod: silent) and is ignored; dev manifests (no sizes) accept any key", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const html = await render({ url: "/c/missing.js", strategy: "eager" }, { sizes: { "/c/Island.js": 1_000 } });
    assert.equal(entryOf(html, "/c/missing.js"), undefined);
    // Production builds drop the warning with the rest of the dev checks.
    assert.equal(warn.mock.calls.length, DEV_RUN ? 1 : 0);
    if (DEV_RUN) assert.match(String(warn.mock.calls[0]![0]), /_rPreload: \/c\/missing\.js is not a chunk of this build/);
  } finally {
    warn.mockRestore();
  }
  assert.deepEqual(entryOf(await render({ url: "/@fs/island.tsx", strategy: "eager" }), "/@fs/island.tsx"), ["/@fs/island.tsx", "e"]);
});

test("_rPreload: outside a resumable render it records nothing", async () => {
  assert.equal(
    await renderToString(() => {
      _rPreload(ISLAND, "eager");
      return "x";
    }),
    "x",
  );
});

test("_rPreload: a page whose only record is a registration ships no state, loader or schedule (zero JS)", async () => {
  const html = await resumableToString(() => staticMod.Static({ url: ISLAND }), { manifest: manifestOf({ loader: "/ld.js" } as ManifestExtra) });
  assert.equal(html, "<p>static</p>");
});

test("_renderNonce: the render's CSP nonce, sanitised like the runtime's own scripts; undefined outside / without one", async () => {
  const seen: (string | undefined)[] = [];
  const render = (nonce?: string) => resumableToString(() => (seen.push(_renderNonce()), "x") as unknown as ServerValue, { manifest: manifestOf(), nonce });
  await render('r4nd"om/+=');
  await render();
  assert.deepEqual(seen, ["r4ndom/+=", undefined]);
  assert.equal(_renderNonce(), undefined);
});
