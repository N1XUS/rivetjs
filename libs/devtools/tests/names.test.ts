// Dev transform naming signals / computeds after their bindings (`nameSignals`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SourceMap, type SourceMapping } from "node:module";
import { compile } from "@rivetjs/compiler";
import { nameSignals, namedCalls, shiftMappings } from "../names.ts";

const names = (code: string) => namedCalls(code).map((call) => call.name);

test("bindings, properties, class fields and assignments name creator calls", () => {
  const code = [
    'import { signal, computed as derive } from "@rivetjs/reactivity";',
    'import * as r from "@rivetjs/reactivity";',
    "const count = signal(0);",
    "let total = derive(() => count() * 2), other = r.signal(1);",
    "const state = { open: signal(false), 'quoted': signal(1), [dynamic]: signal(2) };",
    "class Store { items = signal([]); #secret = signal(0); static shared = r.computed(() => 1); }",
    "function init(self) { self.ready = signal(true); later = signal(1); }",
    "use(signal(3));",
    "const { a } = signal(4);",
  ].join("\n");
  assert.deepEqual(names(code), ["count", "total", "other", "open", "quoted", "items", "secret", "shared", "ready", "later"]);
});

test("context tokens are named after their binding (createContext)", () => {
  assert.deepEqual(names('import { createContext, signal } from "@rivetjs/reactivity";\nexport const ThemeContext = createContext("light");\nconst x = signal(0);'), ["ThemeContext", "x"]);
  // Plain TypeScript app modules (before type stripping).
  const ts = 'import { createContext, type Context } from "@rivetjs/reactivity";\nexport const Theme: Context<"a" | "b"> = createContext<"a" | "b">("a");\n';
  assert.deepEqual(namedCalls(ts, "ts").map((c) => c.name), ["Theme"]);
  assert.match(nameSignals(ts, null, "ts")!.code, /= __rivetName\(createContext<"a" \| "b">\("a"\), "Theme"\);/);
});

test("only creators imported from @rivetjs packages", () => {
  assert.deepEqual(names('import { signal } from "./my-signals";\nconst count = signal(0);\nimport "@rivetjs/runtime/dom";'), []);
  assert.deepEqual(names('import { effect } from "@rivetjs/reactivity";\nconst stop = effect(() => {});'), []);
  assert.equal(nameSignals("const count = signal(0);"), null);
  assert.equal(nameSignals('import { signal } from "@rivetjs/reactivity";\nconst count = signal(0'), null, "unparsable code is left alone");
});

test("the transformed module reports names through the hook and returns the created values", async () => {
  const named = nameSignals('import { signal } from "@rivetjs/reactivity";\nexport const count = signal(0), label = signal("x");\n')!;
  assert.match(named.code, /^export const count = __rivetName\(signal\(0\), "count"\), label = __rivetName\(signal\("x"\), "label"\);$/m);
  // Run it with a stand-in creator and hook.
  const events: [string, unknown][] = [];
  const key = Symbol.for("rivet.devtools");
  (globalThis as Record<symbol, unknown>)[key] = { emit: (type: string, data: { value: unknown; name: string }) => events.push([type, data]) };
  try {
    const body = named.code.replace(/^import .*$/m, "const signal = (v) => ({ v });").replace(/^export /m, "");
    const run = new Function(body + "\nreturn [count, label];") as () => { v: unknown }[];
    const [count, label] = run();
    assert.deepEqual([count, label], [{ v: 0 }, { v: "x" }]);
    assert.deepEqual(events, [["name", { value: count, name: "count" }], ["name", { value: label, name: "label" }]]);
  } finally {
    delete (globalThis as Record<symbol, unknown>)[key];
  }
});

test("source map columns follow the inserted text; lines unchanged", async () => {
  const file = new URL("../../router/tests/fixture/src/routes/_layout.tsx", import.meta.url).pathname;
  const source = await readFile(file, "utf8");
  const result = compile(source, { target: "dom", filename: file, sourceMap: true });
  const named = nameSignals(result.code, result.map)!;
  assert.equal(named.code.split("\n").length, result.code.split("\n").length + 1, "one helper line appended");
  const before = new SourceMap(JSON.parse(result.map!)), after = new SourceMap(JSON.parse(named.map!));
  // The `signal` call and the `;` after it map to the same source positions as before the edit.
  const line = result.code.split("\n").findIndex((l) => l.includes("const clicks = signal(0);"));
  const oldLine = result.code.split("\n")[line]!, newLine = named.code.split("\n")[line]!;
  for (const token of ["signal(0)", ";"]) {
    const was = before.findEntry(line, oldLine.indexOf(token)), now = after.findEntry(line, newLine.indexOf(token)) as SourceMapping;
    assert.ok("originalLine" in was && was.originalLine === source.split("\n").findIndex((l) => l.includes("signal(0)")));
    assert.deepEqual([now.originalLine, now.originalColumn], [was.originalLine, was.originalColumn], token);
  }
});

test("shiftMappings moves only segments at or after an insertion", () => {
  // Line 0: segments at columns 0, 4, 10 (AAAA = col 0, IAAA = +4, MAAA = +6).
  assert.equal(shiftMappings("AAAA,IAAA,MAAA;AAAA", new Map([[0, [[4, 3]]]])), "AAAA,OAAA,MAAA;AAAA");
});
