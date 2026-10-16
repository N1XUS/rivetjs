// `render` dev ref check: present with the `development` condition, absent (code and message) from production bundles.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { compile } from "@rivetjs/compiler";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const entry = fileURLToPath(new URL("../src/utils/dom.tsx", import.meta.url));
const MESSAGE = "Ref was not connected to DOM element returned by custom `render` function";
/** Every `#dev` warning: entry module → message text → targets whose development bundle carries it (keep
 * `scripts/zero-cost/dev-leaks.mjs` DEV_MESSAGES in sync). The avatar one lives in a `clientEffect` callback: the server
 * build drops it (the server `clientEffect` is a no-op), as upstream's effect never runs on the server. */
const DEV_WARNINGS: [entry: string, message: string, devTargets: ("dom" | "server")[]][] = [
  [entry, MESSAGE, ["dom", "server"]],
  [
    fileURLToPath(new URL("../src/vendor/radix-avatar/avatar-primitive.tsx", import.meta.url)),
    "Avatar: Only one `Avatar.Image` component should be rendered per `Avatar.Root`",
    ["dom"],
  ],
  [
    fileURLToPath(new URL("../src/components/radio-group/radio-group.tsx", import.meta.url)),
    "children and label/items both given; children win",
    ["dom", "server"],
  ],
];
const { rolldown } = (await import(createRequire(root + "package.json").resolve("rolldown"))) as typeof import("rolldown");

async function bundle(target: "dom" | "server", dev: boolean, input = entry): Promise<string> {
  const build = await rolldown({
    input,
    logLevel: "silent",
    external: (id) =>
      id.startsWith("node:") || !(id.startsWith(".") || id.startsWith("/") || id.startsWith("\0") || id.startsWith("#") || id.startsWith("@rivetjs/")),
    resolve: { conditionNames: dev ? ["import", "development", "default"] : ["import", "production", "default"] },
    plugins: [
      // Component modules import their stylesheet (`out/<name>.css`): not part of the JS checked here.
      { name: "no-css", load: (id) => (id.endsWith(".css") ? { code: "", moduleType: "js" } : null) },
      {
        name: "rivet-compile",
        transform(source, id) {
          if (!id.endsWith(".tsx")) return null;
          const result = compile(source, { target, filename: id });
          if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("; "));
          return { code: result.code, moduleType: "ts" };
        },
      },
    ],
  });
  const { output } = await build.generate({ format: "esm", minify: true });
  return output[0].code;
}

test("production bundles carry no dev warning (render ref check, avatar image count); development bundles do", async () => {
  for (const [input, message, devTargets] of DEV_WARNINGS)
    for (const target of ["dom", "server"] as const) {
      assert.ok(!(await bundle(target, false, input)).includes(message), `${target}: production bundle contains "${message}"`);
      if (devTargets.includes(target)) assert.ok((await bundle(target, true, input)).includes(message), `${target}: development bundle lacks "${message}"`);
    }
});

// Browser-only check (a `ref()` signal still empty a microtask after `render` returned): happy-dom, development condition.
async function refRun(dev: boolean): Promise<string[]> {
  const script = `
    import { Window } from "happy-dom";
    const w = new Window(); for (const k of ["window", "document", "Node", "Element", "HTMLElement"]) globalThis[k] = k === "window" ? w : w[k];
    const warns = []; console.warn = (m) => warns.push(m);
    const { ref } = await import("@rivetjs/runtime/dom");
    const { dom } = await import(${JSON.stringify(entry)});
    const { render } = await import("@rivetjs/runtime/testing");
    const r = ref();
    render(() => dom.span({ ref: r, render: () => document.createElement("section") }));
    const ok = ref();
    render(() => dom.span({ ref: ok, render: (p) => { const e = document.createElement("section"); p.ref.set(e); return e; } }));
    await new Promise((res) => setTimeout(res, 0));
    console.log(JSON.stringify(warns));`;
  const out = execFileSync(
    process.execPath,
    [...(dev ? ["--conditions=development"] : []), "--import", "@rivetjs/runtime/testing/register", "--input-type=module", "-e", script],
    {
      cwd: root,
      env: { ...process.env, RIVET_TEST_TARGET: "dom", NODE_OPTIONS: "" },
      encoding: "utf8",
    },
  ).trim();
  return JSON.parse(out.split("\n").pop()!);
}

test("a render that drops the ref warns in development only", async () => {
  assert.deepEqual(await refRun(false), []);
  const dev = await refRun(true);
  assert.equal(dev.length, 1);
  assert.ok(dev[0].startsWith(MESSAGE));
});

// Shorthand precedence (`utils/shorthand.ts`): children + a shorthand prop warn in development only, children alone do not;
// Select / ComboBox / CellSelect / TagGroup auto forms take `label` + children (list content) and never warn. Table: component, subpath, the render call.
const SHORTHAND: [name: string, dir: string, call: string][] = [
  ["TextField", "textfield", `C({ "aria-label": "f", label: "L", children: "own" })`],
  ["SearchField", "search-field", `C({ "aria-label": "f", placeholder: "P", children: "own" })`],
  ["NumberField", "number-field", `C({ "aria-label": "f", description: "D", children: "own" })`],
  ["NativeSelect", "native-select", `C({ "aria-label": "f", items: [{ value: "a", label: "A" }], children: "own" })`],
  ["Checkbox", "checkbox", `C({ label: "L", children: "own" })`],
  ["Switch", "switch", `C({ description: "D", children: "own" })`],
  ["Radio", "radio", `G({ "aria-label": "g", children: () => C({ value: "a", label: "L", children: "own" }) })`],
  ["Slider", "slider", `C({ "aria-label": "s", label: "L", children: "own" })`],
  ["CheckboxGroup", "checkbox-group", `C({ "aria-label": "g", label: "L", children: "own" })`],
  ["RadioGroup", "radio-group", `C({ "aria-label": "g", errorMessage: "E", children: "own" })`],
  ["CheckboxButtonGroup", "checkbox-button-group", `C({ "aria-label": "g", items: [{ value: "a", label: "A" }], children: "own" })`],
  ["RadioButtonGroup", "radio-button-group", `C({ "aria-label": "g", label: "L", children: "own" })`],
  ["Pagination", "pagination", `C({ total: 3, children: "own" })`],
  ["CellSlider", "cell-slider", `C({ "aria-label": "s", label: "L", children: "own" })`],
  ["Stepper.Step", "stepper", `C({ "aria-label": "s", children: () => C.Step({ title: "T", children: "own" }) })`],
];
const SILENT = [
  // children alone / shorthand alone
  ["radio-group", `C({ "aria-label": "g", children: "own" })`],
  ["radio-group", `C({ "aria-label": "g", label: "Tier", items: [{ value: "x", label: "X" }] })`],
  ["textfield", `C({ label: "L", placeholder: "P" })`],
  // Select auto form: label + ListBox children
  ["select", `C({ label: "Pick", children: "own" })`],
  // T22 auto forms: children are the list content
  ["combo-box", `C({ label: "Pick", children: "own" })`],
  ["cell-select", `C({ label: "Pick", children: "own" })`],
  ["tag-group", `C({ label: "Tags", children: "own" })`],
  // `items` + a render function = the auto form; ComboBox `items` + compound children = RAC's inherited items
  ["cell-select", `C({ "aria-label": "c", items: [{ id: "a" }], children: () => "own" })`],
  ["combo-box", `C({ "aria-label": "c", items: [{ id: "a" }], children: S(() => "own") })`],
] as const;
// `items` next to compound (slot) children: the compound form renders, `items` is ignored (`warnItemsIgnored`).
const ITEMS: [name: string, dir: string][] = [
  ["Select", "select"],
  ["Autocomplete", "autocomplete"],
  ["CellSelect", "cell-select"],
  ["InlineSelect", "inline-select"],
  ["TagGroup", "tag-group"],
];

async function shorthandRun(dev: boolean): Promise<string[]> {
  const mod = (dir: string) => JSON.stringify(fileURLToPath(new URL(`../src/components/${dir}/index.ts`, import.meta.url)));
  const exportOf = (dir: string) =>
    dir
      .split("-")
      .map((w) => (w === "textfield" ? "TextField" : w[0]!.toUpperCase() + w.slice(1)))
      .join("");
  const group = mod("radio-group");
  const lines = [
    ...SHORTHAND.map(([, dir, call]) => [dir, call] as const),
    ...ITEMS.map(([, dir]) => [dir, `C({ "aria-label": "c", items: [{ id: "a" }], children: S(() => "own") })`] as const),
    ...SILENT,
  ].map(([dir, call]) => `{ const C = (await import(${mod(dir)}))[${JSON.stringify(exportOf(dir))}]; await renderToString(() => ${call}); }`);
  const script = `
    const warns = []; console.warn = (m) => warns.push(m);
    const { renderToString } = await import("@rivetjs/runtime/testing/server");
    const G = (await import(${group})).RadioGroup;
    const S = (await import("@rivetjs/runtime/slot"))._slot;
    ${lines.join("\n    ")}
    console.log(JSON.stringify(warns));`;
  const out = execFileSync(
    process.execPath,
    [...(dev ? ["--conditions=development"] : []), "--import", "@rivetjs/runtime/testing/register", "--input-type=module", "-e", script],
    { cwd: root, env: { ...process.env, RIVET_TEST_TARGET: "server", NODE_OPTIONS: "" }, encoding: "utf8" },
  ).trim();
  return JSON.parse(out.split("\n").pop()!);
}

test("shorthand props / items next to children warn in development only (children win; auto forms never warn)", async () => {
  assert.deepEqual(await shorthandRun(false), []);
  assert.deepEqual(await shorthandRun(true), [
    ...SHORTHAND.map(([name]) => `[rivet ui] ${name}: children and label/items both given; children win`),
    ...ITEMS.map(([name]) => `[rivet ui] ${name}: items and compound children both given; children win, items ignored`),
  ]);
});

// cdk `labelProps` "no visible label" warning (dev + NODE_ENV=development): a labelled ui field never logs it.
// Regression 2026-10-12: every Select logged it (the cdk Select parts form computed its no-Label ids through `labelProps`).
test("labelled pickers log no cdk labelProps warning in development", async () => {
  const mod = (dir: string) => JSON.stringify(fileURLToPath(new URL(`../src/components/${dir}/index.ts`, import.meta.url)));
  const cases: [dir: string, name: string, call: string][] = [
    ["select", "Select", `C({ label: "Pick", items: [{ id: "a", label: "A" }] })`],
    ["select", "Select", `C({ label: "Pick", children: "own" })`],
    ["combo-box", "ComboBox", `C({ label: "Pick", items: [{ id: "a", label: "A" }] })`],
    ["autocomplete", "Autocomplete", `C({ label: "Pick", items: [{ id: "a", label: "A" }] })`],
    ["cell-select", "CellSelect", `C({ label: "Pick", items: [{ id: "a", label: "A" }] })`],
    ["textfield", "TextField", `C({ label: "Name" })`],
  ];
  const script = `
    const warns = []; console.warn = (m) => warns.push(String(m));
    const { renderToString } = await import("@rivetjs/runtime/testing/server");
    ${cases.map(([dir, name, call]) => `{ const C = (await import(${mod(dir)}))[${JSON.stringify(name)}]; await renderToString(() => ${call}); }`).join("\n    ")}
    console.log(JSON.stringify(warns.filter((w) => w.includes("labelProps"))));`;
  const out = execFileSync(
    process.execPath,
    ["--conditions=development", "--import", "@rivetjs/runtime/testing/register", "--input-type=module", "-e", script],
    { cwd: root, env: { ...process.env, NODE_ENV: "development", RIVET_TEST_TARGET: "server", NODE_OPTIONS: "" }, encoding: "utf8" },
  ).trim();
  assert.deepEqual(JSON.parse(out.split("\n").pop()!), []);
});
