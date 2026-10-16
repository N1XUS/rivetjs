// Function Bridge T4b (C4b): local functions stored by name into captured holders become symbols.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "../index.ts";
import { roundTrip } from "../../runtime/tests/resume/bridge-encode.ts";

// Adapted from the brief: output whitespace normalized (the printer splits blocks over lines), ids are content hashes
// (`Page$<base36>`, Function Bridge C2) and the onClick handler is an `__rivetR_on` site, not `__rivetR_fn`.
const server = (body: string, handler = "api.open()") =>
  compile(
    `import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n  return <button onClick={() => ${handler}}>{n()}</button>;\n}`,
    { filename: "src/by-name.tsx", target: "server", resume: { module: "src/by-name.tsx" } },
  ).code.replace(/\s+/g, " ");
const ID = String.raw`"src/by-name\.tsx#Page\$[0-9a-z]+(?:_\d+)?"`;

test("const arrow stored by name into a captured holder gets one recipe at its declaration", () => {
  const out = server("  const open = () => n.set(n() + 1);\n  const api = {}; api.open = open; const list = []; list.push(open);");
  assert.match(out, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(n\(\) \+ 1\), \[n\]\);`));
  assert.match(out, /api\.open = open;/);
  // One recipe for `open` (never per store) and exactly one more resume site, the onClick handler (`__rivetR_on`).
  assert.equal(out.match(/__rivetR_fn\(/g)?.length, 1);
  assert.equal(out.match(/__rivetR_on\(/g)?.length, 1);
});

test("function declaration stored by name is stamped once at the top of the body (T6)", () => {
  const out = server("  const api = {}; api.open = open; function open() { n.set(n() + 1); }");
  // Function Bridge T6: the registration moved from right after the declaration to the body top, captures as a thunk.
  assert.match(out, new RegExp(String.raw`function Page\(\) \{ __rivetR_fn\(${ID}, open, \(\) => \[n\]\); const n = signal\(0\);`));
  assert.match(out, /function open\(\) \{ n\.set\(n\(\) \+ 1\); \} return /);
  // Hoisting kept: still a declaration, assigned before it; stamped once.
  assert.match(out, /api\.open = open; function open\(\)/);
  assert.equal(out.match(/__rivetR_fn\(/g)?.length, 1);
});

test("holder reached through data is searched", () => {
  const out = server("  const inner = {}; const outer = { inner }; inner.go = () => n.set(1); const api = { open: () => outer.inner.go() };");
  assert.match(out, /inner\.go = __rivetR_fn\(/);
});

test("a function stored into a captured holder only through a consumed call is not stamped (review M2)", () => {
  // `tick` reaches the captured `api` only as an argument of a consumed call: the holder stores the call's result.
  const global = server("  const tick = () => n.set(n() + 1); const api = { t: setTimeout(tick, 10) };", "void api");
  assert.doesNotMatch(global, /const tick = __rivetR_fn\(/);
  const method = server("  const tick = (x: number) => x + n(); const api = { xs: [1].map(tick) };", "void api");
  assert.doesNotMatch(method, /const tick = __rivetR_fn\(/);
  const assigned = server("  const tick = () => n.set(n() + 1); const api: { h?: number } = {}; api.h = requestAnimationFrame(tick);", "void api");
  assert.doesNotMatch(assigned, /const tick = __rivetR_fn\(/);
  // Positive twin: the same position under a call that is not consumed stores `tick` → stamped.
  const frozen = server("  const tick = () => n.set(n() + 1); const api = { t: Object.freeze(tick) };", "void api");
  assert.match(frozen, new RegExp(String.raw`const tick = __rivetR_fn\(${ID}, \(\) => n\.set\(n\(\) \+ 1\), \[n\]\);`));
});

test("store calls on a captured holder: push, Map set, a signal holding a function", () => {
  const pushed = server("  const open = () => n.set(1); const list: (() => void)[] = []; list.push(open);", "list[0]!()");
  assert.match(pushed, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\);`));
  const mapped = server('  const open = () => n.set(1); const m = new Map<string, () => void>(); m.set("k", open);', 'm.get("k")!()');
  assert.match(mapped, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\);`));
  const held = server("  const open = () => n.set(1); const step = signal<() => void>(() => {}); step.set(open);", "step()()");
  assert.match(held, new RegExp(String.raw`const open = __rivetR_fn\(${ID}, \(\) => n\.set\(1\), \[n\]\);`));
});

test("a named function whose capture is in its TDZ at the declaration stays plain", () => {
  const later = server("  const api: { open?: () => void } = {}; const open = () => stop(); api.open = open; const stop = () => n.set(0);", "api.open!()");
  assert.match(later, /const open = \(\) => stop\(\);/);
});

// Review M3: executed encode. Compile with the real wasm, render `Page` inside a resumable render, encode the holder the
// handler captures (exposed through `globalThis.__held`) and decode it in the browser decoder: the stored function must
// come back as the stamped recipe (symbol id → factory), not throw "function is not serializable".
const executed = async (body: string): Promise<unknown> => {
  const code = compile(`import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n}`, {
    filename: "src/by-name.tsx",
    target: "server",
    resume: { module: "src/by-name.tsx" },
  }).code;
  const ids = [...code.matchAll(/__rivetR_fn\("([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(ids.length, 1, code);
  // The onClick handler and the `{n()}` binding are symbols too: the manifest needs a chunk for every id.
  const handlers = [...new Set([...code.matchAll(/"(src\/by-name\.tsx#[^"]+)"/g)].map((m) => m[1]!))].filter((id) => id !== ids[0]);
  const dir = mkdtempSync(join(tmpdir(), "rivet-t4b-"));
  try {
    const file = join(dir, "page.mjs");
    writeFileSync(
      file,
      code.replace(/"(@rivetjs\/[^"]+)"/g, (_, spec: string) => JSON.stringify(import.meta.resolve(spec))),
    );
    const { Page } = (await import(pathToFileURL(file).href)) as { Page: () => unknown };
    const g = globalThis as { __held?: unknown };
    const { values } = await roundTrip(
      () => {
        Page();
        return [g.__held];
      },
      { ...Object.fromEntries(handlers.map((id) => [id, () => "browser-handler"])), [ids[0]!]: () => "browser-open" },
    );
    delete g.__held;
    return values[0];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const expose = (holder: string, handler: string) =>
  `  (globalThis as { __held?: unknown }).__held = ${holder};\n  return <button onClick={() => ${handler}}>{n()}</button>;`;

test("executed: const arrow stored by name encodes as its recipe", async () => {
  const api = (await executed(
    `  const open = () => n.set(n() + 1);\n  const api: { open?: () => void } = {}; api.open = open;\n${expose("api", "api.open!()")}`,
  )) as {
    open: unknown;
  };
  assert.equal(api.open, "browser-open");
});

test("executed: function declaration before the return encodes as its recipe", async () => {
  const api = (await executed(
    `  const api: { open?: () => void } = {}; api.open = open;\n  function open() { n.set(n() + 1); }\n${expose("api", "api.open!()")}`,
  )) as { open: unknown };
  assert.equal(api.open, "browser-open");
});

// Review M1: before T6 the stamp sat right after the declaration, so a declaration below the `return` was never
// stamped. T6 registers function declarations at the top of the enclosing body (thunk captures).
test("executed: function declaration after the return encodes as its recipe", async () => {
  const api = (await executed(
    `  const api: { open?: () => void } = {}; api.open = open;\n${expose("api", "api.open!()")}\n  function open() { n.set(n() + 1); }`,
  )) as { open: unknown };
  assert.equal(api.open, "browser-open");
});

test("executed: list.push(open) encodes the list with the recipe", async () => {
  const list = (await executed(
    `  const open = () => n.set(1);\n  const list: (() => void)[] = []; list.push(open);\n${expose("list", "list[0]!()")}`,
  )) as unknown[];
  assert.deepEqual(list, ["browser-open"]);
});

test("executed: a holder reached through data encodes its stored function", async () => {
  const outer = (await executed(
    `  const inner: { go?: () => void } = {}; const outer = { inner }; inner.go = () => n.set(1);\n${expose("outer", "outer.inner.go!()")}`,
  )) as { inner: { go: unknown } };
  assert.equal(outer.inner.go, "browser-open");
});
