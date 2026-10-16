// Function Bridge T6 (C5): function declarations register at the top of their body, captures as a thunk.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "../index.ts";
import { roundTrip } from "../../runtime/tests/resume/bridge-encode.ts";

// Brief tests verbatim, plus: block / `case` scoped declarations, the T4b stored-by-name path, a capture declared after
// the declaration (no TDZ rule for a hoisted registration), the DOM target unchanged, and executed encodes for the
// T4b review M1 layouts (after `return`, after an early `return` inside `if`, after `throw`).
const ID = String.raw`"src/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?"`;
const raw = (source: string, target: "server" | "dom" = "server") =>
  (compile(source, { target, filename: "a.tsx", resume: { module: "src/a.tsx" } } as never) as { code: string }).code;
const server = (source: string) => raw(source).replace(/\s+/g, " ");
const count = (code: string, what: string) => code.split(what).length - 1;

test("a declaration after return registers first, with thunk captures", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  return <button onClick={() => bump()}>{n()}</button>;
  function bump() { n.set(n() + 1); }
}`);
  assert.match(code, new RegExp(String.raw`function Page\(\) \{ __rivetR_fn\(${ID}, bump, \(\) => \[n\]\); const n = signal\(0\);`));
  assert.equal(code.split("__rivetR_fn(").length - 1, 1);
});

test("a declaration before use registers at the top too", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  function bump() { n.set(n() + 1); }
  return <button onClick={() => bump()}>{n()}</button>;
}`);
  assert.match(code, new RegExp(String.raw`function Page\(\) \{ __rivetR_fn\(${ID}, bump, \(\) => \[n\]\);`));
  // Nothing stamped at the declaration any more.
  assert.match(code, /function bump\(\) \{ n\.set\(n\(\) \+ 1\); \} return /);
});

test("several declarations register in source order, after directives", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  "use strict";
  const n = signal(0);
  return <button onClick={() => { up(); down(); }}>{n()}</button>;
  function up() { n.set(n() + 1); }
  function down() { n.set(n() - 1); }
}`);
  assert.match(code, new RegExp(String.raw`"use strict"; __rivetR_fn\(${ID}, up, \(\) => \[n\]\); __rivetR_fn\(${ID}, down, \(\) => \[n\]\); const n`));
  assert.equal(count(code, "__rivetR_fn("), 2);
});

test("a block-scoped declaration registers at the top of its block, a case-scoped one at the top of its clause", () => {
  const block = server(`import { signal } from "@rivetjs/reactivity";
export function Page(props: { on: boolean }) {
  const n = signal(0);
  if (props.on) {
    const m = 1;
    return <button onClick={() => bump()}>{n()}</button>;
    function bump() { n.set(n() + m); }
  }
  return null;
}`);
  assert.match(block, new RegExp(String.raw`if \(props\.on\) \{ __rivetR_fn\(${ID}, bump, \(\) => \[n, m\]\); const m = 1;`));
  const clause = server(`import { signal } from "@rivetjs/reactivity";
export function Page(props: { k: number }) {
  const n = signal(0);
  switch (props.k) {
    case 1:
      return <button onClick={() => bump()}>{n()}</button>;
      function bump() { n.set(1); }
    default:
      return null;
  }
}`);
  assert.match(clause, new RegExp(String.raw`case 1: __rivetR_fn\(${ID}, bump, \(\) => \[n\]\); return `));
});

test("T4b: a declaration stored by name registers at the top; a capture declared after it no longer keeps it plain", () => {
  const code = server(`import { signal } from "@rivetjs/reactivity";
export function Page() {
  const api: { open?: () => void } = {};
  api.open = open;
  function open() { m.set(1); }
  const m = signal(0);
  return <button onClick={() => api.open!()}>{m()}</button>;
}`);
  assert.match(code, new RegExp(String.raw`function Page\(\) \{ __rivetR_fn\(${ID}, open, \(\) => \[m\]\); const api`));
  assert.equal(count(code, "__rivetR_fn("), 1);
});

test("the DOM target is unchanged", () => {
  const dom = raw(
    `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  return <button onClick={() => bump()}>{n()}</button>;
  function bump() { n.set(n() + 1); }
}`,
    "dom",
  );
  assert.doesNotMatch(dom, /__rivetR_fn|_rFn/);
});

// Executed (T4b review M1): compile with the real wasm, render `Page` inside a resumable render, encode the holder the
// handler captures (exposed through `globalThis.__held`) and decode it: the stored function must come back as its
// recipe (symbol id → factory), never "function is not serializable". The recipe's factory returns the decoded
// captures (fix round 1, review M2), so a test can check what the thunk read at encode.
type Recipe = { recipe: string; captures: unknown[] };
const executed = async (body: string): Promise<unknown> => {
  const code = raw(`import { signal } from "@rivetjs/reactivity";\nexport function Page() {\n  const n = signal(0);\n${body}\n}`);
  const ids = [...code.matchAll(/__rivetR_fn\("([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(ids.length, 1, code);
  const others = [...new Set([...code.matchAll(/"(src\/a\.tsx#[^"]+)"/g)].map((m) => m[1]!))].filter((id) => id !== ids[0]);
  const dir = mkdtempSync(join(tmpdir(), "rivet-t6-"));
  try {
    const file = join(dir, "page.mjs");
    writeFileSync(
      file,
      code.replace(/"(@rivetjs\/[^"]+)"/g, (_, spec: string) => JSON.stringify(import.meta.resolve(spec))),
    );
    const { Page } = (await import(pathToFileURL(file).href)) as { Page: () => unknown };
    const g = globalThis as { __held?: unknown };
    try {
      const { values } = await roundTrip(
        () => {
          Page();
          return [g.__held];
        },
        {
          ...Object.fromEntries(others.map((id) => [id, () => "browser-handler"])),
          [ids[0]!]: (...captures: unknown[]): Recipe => ({ recipe: "browser-open", captures }),
        },
      );
      return values[0];
    } finally {
      delete g.__held;
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const store = `  const api: { open?: () => void } = {}; api.open = open;\n  (globalThis as { __held?: unknown }).__held = api;`;
const view = `<button onClick={() => api.open!()}>{n()}</button>`;
// The decoded capture is the browser signal (`roundTrip`'s fake): its value is the server value at encode.
const opened = (api: unknown): Recipe => {
  const open = (api as { open: Recipe }).open;
  assert.equal(open.recipe, "browser-open");
  return open;
};
const signalValue = (capture: unknown) => (capture as () => unknown)();

test("executed: declaration after the return", async () => {
  const open = opened(await executed(`${store}\n  return ${view};\n  function open() { n.set(n() + 1); }`));
  assert.equal(open.captures.length, 1);
  assert.equal(signalValue(open.captures[0]), 0);
});

test("executed: declaration after an early return inside if", async () => {
  opened(await executed(`${store}\n  if (n() >= 0) return ${view};\n  return null;\n  function open() { n.set(n() + 1); }`));
});

test("executed: declaration after throw", async () => {
  opened(await executed(`${store}\n  if (n() >= 0) {\n    return ${view};\n  }\n  throw new Error("negative");\n  function open() { n.set(n() + 1); }`));
});

test("executed: a capture declared after the declaration is read at encode", async () => {
  // `m` is in its TDZ where the registration runs (body top); the thunk reads it at the first encode: value 1.
  const open = opened(await executed(`${store}\n  function open() { m.set(m() + 1); }\n  const m = signal(1);\n  return ${view};`));
  assert.equal(open.captures.length, 1);
  assert.equal(signalValue(open.captures[0]), 1);
});

test("executed: a block-scoped declaration registers at the top of its block", async () => {
  // Registration inside the `if` block, before `const m`; the declaration sits after the block's `return`.
  const open = opened(
    await executed(`  if (n() >= 0) {\n    const m = signal(2);\n${store}\n    return ${view};\n    function open() { m.set(m() + 1); }\n  }\n  return null;`),
  );
  assert.equal(signalValue(open.captures[0]), 2);
});

test("executed: a case-scoped declaration registers at the top of its clause", async () => {
  const open = opened(
    await executed(
      `  switch (n()) {\n    case 0:\n${store}\n      return ${view};\n      function open() { n.set(n() + 1); }\n    default:\n      return null;\n  }`,
    ),
  );
  assert.equal(signalValue(open.captures[0]), 0);
});

test("executed: an early exit before a capture's declarator fails at encode, naming the recipe", async () => {
  // `open` is stored and encoded on the early path, but `m` is never initialized: the thunk throws at encode.
  await assert.rejects(
    executed(`${store}\n  if (n() >= 0) return ${view};\n  const m = signal(1);\n  return null;\n  function open() { m.set(1); }`),
    /Cannot resume src\/a\.tsx#Page\$[0-9a-z]+(?:_\d+)?: captures /,
  );
});
