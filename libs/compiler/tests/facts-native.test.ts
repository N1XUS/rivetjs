// ZERO STATESPACE: the per-call-site native automaton proof (`facts-native.ts`) over hand-built module facts (no wasm).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { boundaryFacts } from "../facts-fixpoint.ts";
import { nativeFamilies, stylesState } from "../facts-native.ts";
import type { ComponentBoundaryFacts, ModuleFacts } from "../index.ts";

type Call = { tag: string; data?: boolean; fn?: boolean; around?: string[]; inputs?: boolean; attrs?: string[] };
type Component = Omit<Partial<ComponentBoundaryFacts>, "renders" | "calls"> & { calls?: Call[] };

function module(components: Record<string, Component>, imports: Record<string, [string, string]> = {}, extra: Partial<ModuleFacts> = {}): ModuleFacts {
  const boundaries = new Map<string, ComponentBoundaryFacts>();
  for (const [name, c] of Object.entries(components))
    boundaries.set(name, {
      interactive: c.interactive ?? false,
      source: c.source ?? false,
      provides: c.provides ?? false,
      listens: c.listens ?? false,
      context: c.context ?? false,
      params: c.params ?? "object",
      renders: new Set((c.calls ?? []).map((call) => call.tag)),
      calls: (c.calls ?? []).map((call) => ({ data: true, fn: false, around: [], inputs: call.data ?? true, attrs: [], ...call })),
    });
  return {
    imports: new Map(Object.entries(imports).map(([local, [from, imported]]) => [local, { from, imported }])),
    statics: new Set(Object.values(imports).map(([from]) => from)),
    dynamics: new Set(),
    components: new Map([...boundaries.keys()].map((name) => [name, new Set<string>()])),
    groups: [],
    preload: null,
    defaultName: null,
    exports: new Map([...boundaries.keys()].map((name) => [name, name])),
    reexports: new Map(),
    stars: [],
    compounds: new Map(),
    ...extra,
    boundaries,
  };
}

const UI = "ui/switch.tsx";
const PRAGMA = "// @rivet-native SwitchRoot(children,class,defaultSelected) SwitchContent(children,class) SwitchThumb(children)";
const family = () =>
  module(
    {
      // The root's shorthand renders its own parts (family code: no orphan).
      SwitchRoot: { context: true, calls: [{ tag: "SwitchContent" }, { tag: "SwitchThumb", around: ["SwitchContent"] }] },
      SwitchContent: { context: true },
      SwitchThumb: { context: true },
    },
    {},
    {
      exports: new Map(["SwitchRoot", "SwitchContent", "SwitchThumb", "Switch"].map((name) => [name, name])),
      compounds: new Map([
        [
          "Switch",
          {
            root: "SwitchRoot",
            parts: new Map([
              ["Content", "SwitchContent"],
              ["Thumb", "SwitchThumb"],
            ]),
          },
        ],
      ]),
    },
  );
const imports: Record<string, [string, string]> = { Switch: ["./switch", "Switch"], Icon: ["./icon", "Icon"] };
const icon = () => module({ Icon: {} });

function prove(page: Record<string, Component>, styled: string[] = [], pageExtra: Partial<ModuleFacts> = {}) {
  const facts = new Map<string, ModuleFacts>([
    // The page module's `Page` is a route root (static inputs: not live).
    ["app/page.tsx", module(page, imports, { defaultName: "Page", ...pageExtra })],
    [UI, family()],
    ["ui/icon.tsx", icon()],
  ]);
  const resolved = new Map([
    [
      "app/page.tsx",
      new Map([
        ["./switch", UI],
        ["./icon", "ui/icon.tsx"],
      ]),
    ],
  ]);
  const verdicts = boundaryFacts(facts, resolved, new Set(["app/page.tsx"]), new Set(), undefined, {
    families: new Map([[UI, nativeFamilies(PRAGMA)]]),
    stateStyled: new Set(styled),
  });
  return verdicts.native("app/page.tsx");
}

const site = (root: Partial<Call> = {}, content: Partial<Call> = {}, extra: Call[] = []): Component => ({
  calls: [
    { tag: "Switch", attrs: ["defaultSelected"], ...root },
    { tag: "Switch.Content", around: ["Switch"], attrs: ["class"], ...content },
    { tag: "Switch.Thumb", around: ["Switch.Content", "Switch"] },
    ...extra,
  ],
});

test("nativeFamilies parses the pragma: root first, per-part props", () => {
  const [f] = nativeFamilies(PRAGMA);
  assert.equal(f!.root, "SwitchRoot");
  assert.deepEqual([...f!.parts.keys()], ["SwitchRoot", "SwitchContent", "SwitchThumb"]);
  assert.deepEqual([...f!.parts.get("SwitchRoot")!], ["children", "class", "defaultSelected"]);
  assert.deepEqual(nativeFamilies("const x = 1;"), []);
});

test("a closed call site with declared data props is proven", () => {
  assert.deepEqual(prove({ Page: site() }), ["Page:0"]);
  // data-* / aria-* attributes are always allowed.
  assert.deepEqual(prove({ Page: site({ attrs: ["data-x", "aria-label"] }) }), ["Page:0"]);
});

test("escapes keep today's path: undeclared props, live values, spreads, functions, render props", () => {
  assert.deepEqual(prove({ Page: site({ attrs: ["onChange*"], fn: true }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["isSelected"] }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["defaultSelected*"] }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["..."] }) }), []);
  assert.deepEqual(prove({ Page: site({ attrs: ["()"] }) }), []);
  assert.deepEqual(prove({ Page: site({}, { attrs: ["class*"] }) }), []);
  assert.deepEqual(prove({ Page: site({}, { fn: true }) }), []);
});

test("other components inside the root: static, context-free instances only", () => {
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", around: ["Switch.Content", "Switch"] }]) }), ["Page:0"]);
  // Non-data inputs from a caller that is not live are static values.
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", around: ["Switch"], data: false, attrs: ["icon*"] }]) }), ["Page:0"]);
  // A function passed in, or an unresolved component: unknown.
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", around: ["Switch"], fn: true }]) }), []);
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Mystery", around: ["Switch"] }]) }), []);
  // An Icon outside the root does not matter.
  assert.deepEqual(prove({ Page: site({}, {}, [{ tag: "Icon", fn: true }]) }), ["Page:0"]);
});

test("a part outside any root (a wrapper) or used as a value makes the whole family unproven", () => {
  assert.deepEqual(prove({ Page: site(), Wrapper: { calls: [{ tag: "Switch.Content" }] } }), []);
  assert.deepEqual(prove({ Page: site() }, [], { componentValues: ["Switch"] }), []);
});

test("a caller module that styles component state (data-selected / aria-expanded selectors) stays unproven", () => {
  assert.deepEqual(prove({ Page: site() }, ["app/page.tsx"]), []);
  assert.equal(stylesState(`class="data-selected:bg-accent"`), true);
  assert.equal(stylesState(`class="group-data-[expanded=true]:rotate-180"`), true);
  assert.equal(stylesState(`class="[&:has([aria-expanded='true'])]:rounded-none"`), true);
  assert.equal(stylesState(`<li aria-checked={on() ? "true" : "false"} data-slot="switch">`), false);
});

// TABLE-NATIVE: the ui Table family (declaration read from the real module): a static compound / auto-form table is proven,
// every behaviour prop / render prop / live value / non-part component / self-nested part keeps the grid path.
const TABLE = "ui/table.tsx";
const TABLE_PARTS = ["Root", "ScrollContainer", "Content", "Header", "Column", "Body", "Row", "Cell", "Footer"];
const TABLE_OTHER = ["ColumnResizer", "ResizableContainer", "LoadMore", "SortableColumnHeader", "Collection"];
const tableFamily = () =>
  module(
    Object.fromEntries([...TABLE_PARTS, ...TABLE_OTHER].map((p) => [`Table${p}`, { context: true, interactive: true }])),
    {},
    {
      exports: new Map([...[...TABLE_PARTS, ...TABLE_OTHER].map((p) => `Table${p}`), "Table"].map((name) => [name, name])),
      compounds: new Map([
        ["Table", { root: "TableRoot", parts: new Map([...TABLE_PARTS, ...TABLE_OTHER].filter((p) => p !== "Root").map((p) => [p, `Table${p}`])) }],
      ]),
    },
  );
const tableSource = readFileSync(fileURLToPath(new URL("../../ui/src/components/table/table.tsx", import.meta.url)), "utf8");

function proveTable(page: Record<string, Component>) {
  const facts = new Map<string, ModuleFacts>([
    ["app/page.tsx", module(page, { Table: ["./table", "Table"], Icon: ["./icon", "Icon"] }, { defaultName: "Page" })],
    [TABLE, tableFamily()],
    ["ui/icon.tsx", icon()],
  ]);
  const resolved = new Map([
    [
      "app/page.tsx",
      new Map([
        ["./table", TABLE],
        ["./icon", "ui/icon.tsx"],
      ]),
    ],
  ]);
  return boundaryFacts(facts, resolved, new Set(["app/page.tsx"]), new Set(), undefined, {
    families: new Map([[TABLE, nativeFamilies(tableSource)]]),
    stateStyled: new Set(),
  }).native("app/page.tsx");
}

/** `<Table><ScrollContainer><Content><Header><Column/>…</Header><Body><Row><Cell/>…</Row></Body></Content></ScrollContainer></Table>`. */
type TableEdit = Partial<Record<"root" | "content" | "column" | "body" | "row" | "cell", Partial<Call>>> & { extra?: Call[] };
const table = (edit: TableEdit = {}): Component => {
  const inContent = ["Table.Content", "Table.ScrollContainer", "Table"];
  return {
    calls: [
      { tag: "Table", attrs: [], ...edit.root },
      { tag: "Table.ScrollContainer", around: ["Table"] },
      { tag: "Table.Content", around: ["Table.ScrollContainer", "Table"], attrs: ["aria-label", "class"], ...edit.content },
      { tag: "Table.Header", around: inContent },
      { tag: "Table.Column", around: ["Table.Header", ...inContent], attrs: ["isRowHeader"], ...edit.column },
      { tag: "Table.Column", around: ["Table.Header", ...inContent] },
      { tag: "Table.Body", around: inContent, ...edit.body },
      { tag: "Table.Row", around: ["Table.Body", ...inContent], attrs: ["id"], ...edit.row },
      { tag: "Table.Cell", around: ["Table.Row", "Table.Body", ...inContent], ...edit.cell },
      { tag: "Table.Cell", around: ["Table.Row", "Table.Body", ...inContent], attrs: ["colSpan", "class"] },
      ...(edit.extra ?? []),
    ],
  };
};
const deepIn = ["Table.Cell", "Table.Row", "Table.Body", "Table.Content", "Table.ScrollContainer", "Table"];

test("table: the declaration covers the static parts only", () => {
  const [f] = nativeFamilies(tableSource);
  assert.equal(f!.root, "TableRoot");
  assert.deepEqual(
    [...f!.parts.keys()],
    ["TableRoot", "TableScrollContainer", "TableContent", "TableHeader", "TableColumn", "TableBody", "TableRow", "TableCell", "TableFooter"],
  );
  for (const [, keys] of f!.parts)
    for (const behaviour of ["selectionMode", "sortDescriptor", "onRowAction", "allowsSorting", "href", "onAction", "isDisabled", "renderEmptyState"])
      assert.equal(keys.has(behaviour), false, behaviour);
});

test("table: a static compound table, the auto form with data, a nested table and an Icon in a cell are proven", () => {
  assert.deepEqual(proveTable({ Page: table() }), ["Page:0"]);
  assert.deepEqual(proveTable({ Page: { calls: [{ tag: "Table", attrs: ["aria-label", "columns", "items", "footer", "class", "variant"] }] } }), ["Page:0"]);
  assert.deepEqual(proveTable({ Page: table({ extra: [{ tag: "Icon", around: deepIn }] }) }), ["Page:0"]);
  // A static table inside a cell: both roots proven (the inner root ends the self-nesting scan).
  const inner = table().calls!.map((c) => ({ ...c, around: [...(c.around ?? []), ...deepIn] }));
  const outer = table({ extra: inner });
  assert.deepEqual(proveTable({ Page: outer }), ["Page:0", "Page:10"]);
});

test("table: behaviour, live values, render props and spreads keep the grid path", () => {
  const off = (edit: TableEdit, why: string) => assert.deepEqual(proveTable({ Page: table(edit) }), [], why);
  for (const attr of [
    "selectionMode",
    "selectedKeys*",
    "defaultSelectedKeys",
    "onSelectionChange*",
    "sortDescriptor*",
    "onSortChange*",
    "onRowAction*",
    "onCellAction*",
    "disabledKeys",
    "expandedKeys*",
    "treeColumn",
    "keyboardNavigationBehavior",
    "style",
    "...",
  ])
    off({ content: { attrs: ["aria-label", attr] } }, `content ${attr}`);
  off({ content: { fn: true } }, "content fn");
  for (const attr of ["selectionMode", "sortDescriptor", "onRowAction", "items*", "columns*", "class*", "variant*", "()"])
    off({ root: { attrs: [attr] } }, `root ${attr}`);
  for (const attr of ["allowsSorting", "width", "defaultWidth", "isRowHeader*", "()"]) off({ column: { attrs: [attr] } }, `column ${attr}`);
  for (const attr of ["items*", "items", "renderEmptyState*", "dependencies", "()"]) off({ body: { attrs: [attr] } }, `body ${attr}`);
  for (const attr of ["href", "onAction*", "isDisabled", "id*", "()"]) off({ row: { attrs: [attr] } }, `row ${attr}`);
  for (const attr of ["()", "class*", "colSpan*"]) off({ cell: { attrs: [attr] } }, `cell ${attr}`);
});

test("table: grid-only parts and other context readers inside the root keep the grid path", () => {
  for (const part of ["Table.ColumnResizer", "Table.ResizableContainer", "Table.LoadMore", "Table.SortableColumnHeader", "Table.Collection"])
    assert.deepEqual(proveTable({ Page: table({ extra: [{ tag: part, around: deepIn }] }) }), [], part);
  assert.deepEqual(proveTable({ Page: table({ extra: [{ tag: "Mystery", around: deepIn }] }) }), []);
});

test("table: a part nested in itself (tree rows, column groups) keeps the grid path", () => {
  assert.deepEqual(
    proveTable({ Page: table({ extra: [{ tag: "Table.Row", around: ["Table.Row", "Table.Body", "Table.Content", "Table.ScrollContainer", "Table"] }] }) }),
    [],
  );
  assert.deepEqual(
    proveTable({
      Page: table({ extra: [{ tag: "Table.Column", around: ["Table.Column", "Table.Header", "Table.Content", "Table.ScrollContainer", "Table"] }] }),
    }),
    [],
  );
});

test("table: a part outside a root anywhere (a row helper / wrapper component) turns the family off", () => {
  assert.deepEqual(proveTable({ Page: table(), RowHelper: { calls: [{ tag: "Table.Row" }, { tag: "Table.Cell", around: ["Table.Row"] }] } }), []);
});

test("table: virtualization props refuse native sites on both root and Content", () => {
  const [family] = nativeFamilies(tableSource);
  for (const prop of ["virtualized", "rowHeight", "headingHeight", "initialSize"]) {
    assert.equal(family!.parts.get("TableRoot")!.has(prop), false);
    assert.equal(family!.parts.get("TableContent")!.has(prop), false);
    assert.deepEqual(proveTable({ Page: table({ root: { attrs: [prop] } }) }), [], `root ${prop}`);
    assert.deepEqual(proveTable({ Page: table({ content: { attrs: ["aria-label", prop] } }) }), [], `Content ${prop}`);
  }
});
