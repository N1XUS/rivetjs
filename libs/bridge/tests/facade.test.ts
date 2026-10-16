// T5 facades (spec §4.2): export lists (declarations, `export { … }`, re-exports, `export *`, type-only skipped,
// component vs plain), the facade TSX (identical for both environments), per-environment definitions and island
// modules, and the facade compiling as a Rivet module in resume mode (symbols: the loader by reference).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import { clientDefs, exportList, facadeSource, islandModule, serverDefs } from "../facade.ts";

test("export list: components = capitalised functions / extending classes / wrapper calls (followed through bindings) vs re-exported values", async () => {
  const source = `
import { memo } from "react";
import * as React from "react";
import { z } from "zod";
import Imported from "./imported";
import { Button } from "@ui/kit";
export function Counter() {}
export class Chart extends React.Component {}
export class Model {}
export const Card = { render() {} };
export const Memo = memo(() => null);
export const Fwd = React.forwardRef((props, ref) => null);
export const Casted = (() => null) as unknown as Comp;
export const Schema = z.object({});
export const Store = createStore();
export const MAX_SIZE = 3;
export const Title = "x";
export const useThing = () => 1;
export const Again = Counter;
export const Wrapped = observer(Chart);
export enum Color { Red }
export type Props = { a: number };
export interface More {}
const Local = () => null;
const label = 1;
export { Local as Panel, label, Imported, Button };
export { Remote, type Shape, helper, Plain } from "./remote";
export * as utils from "./utils";
export * from "./star";
export default Counter;
`;
  const lists: Record<string, { name: string; component: boolean }[]> = {
    "./star": [
      { name: "Starred", component: true },
      { name: "default", component: true },
      { name: "count", component: false },
    ],
    "./remote": [
      { name: "Remote", component: true },
      { name: "helper", component: false },
      { name: "Plain", component: false },
    ],
    "./imported": [{ name: "default", component: true }],
  };
  const list = await exportList(source, async (specifier) => lists[specifier] ?? [], "tsx");
  assert.deepEqual(list, [
    { name: "Counter", component: true },
    { name: "Chart", component: true },
    { name: "Model", component: false },
    { name: "Card", component: false },
    { name: "Memo", component: true },
    { name: "Fwd", component: true },
    { name: "Casted", component: true },
    { name: "Schema", component: false },
    { name: "Store", component: false },
    { name: "MAX_SIZE", component: false },
    { name: "Title", component: false },
    { name: "useThing", component: false },
    { name: "Again", component: true },
    { name: "Wrapped", component: true },
    { name: "Color", component: false },
    { name: "Panel", component: true },
    { name: "label", component: false },
    { name: "Imported", component: true },
    { name: "Button", component: true },
    { name: "Remote", component: true },
    { name: "helper", component: false },
    { name: "Plain", component: false },
    { name: "utils", component: false },
    { name: "Starred", component: true },
    { name: "count", component: false },
    { name: "default", component: true, alias: "Counter" },
  ]);
  // A framework's own wrappers (`BridgeEntry.wrappers`): `component({ … })` of the fake framework.
  const fake = await exportList(`export const Counter = component({ html() {} });\nexport const Card = { html() {} };`, async () => [], "js", {
    wrappers: ["component"],
  });
  assert.deepEqual(fake, [
    { name: "Counter", component: true },
    { name: "Card", component: false },
  ]);
});

test("facade TSX: one island per component, aliased default, plain re-exports; compiles in resume mode on both targets", () => {
  const exports = [
    { name: "Counter", component: true },
    { name: "useThing", component: false },
    { name: "default", component: true, alias: "Counter" },
    { name: "Other", component: true },
  ];
  const text = facadeSource("/app/src/Counter.react.tsx", "src/Counter.react.tsx", exports);
  assert.equal(
    text,
    `// Island facade of src/Counter.react.tsx (@rivetjs/bridge/vite).
import { _island } from "virtual:rivet-bridge/core";
import * as DEF from "virtual:rivet-island-def:/app/src/Counter.react.tsx";
export { useThing } from "virtual:rivet-island-pure:/app/src/Counter.react.tsx";
function load_Counter() {
  return import("virtual:rivet-island-client:/app/src/Counter.react.tsx?export=Counter");
}
export function Counter(props) {
  return <>{_island(props, DEF["Counter"], load_Counter)}</>;
}
export { Counter as default };
function load_Other() {
  return import("virtual:rivet-island-client:/app/src/Counter.react.tsx?export=Other");
}
export function Other(props) {
  return <>{_island(props, DEF["Other"], load_Other)}</>;
}
`,
  );
  const ids = (target: "server" | "dom") => {
    const result = compile(text, {
      target,
      filename: "src/Counter.react.tsx.island.tsx",
      resume: { module: "src/Counter.react.tsx.island" },
    } as never) as unknown as {
      diagnostics: unknown[];
      symbols?: { id: string }[];
      code: string;
    };
    assert.deepEqual(result.diagnostics, []);
    return result;
  };
  const server = ids("server"),
    dom = ids("dom");
  // The loaders resume by reference (`_rMod`), with the same ids on both targets.
  for (const name of ["load_Counter", "load_Other"]) {
    const id = (dom.symbols ?? []).find((symbol) => symbol.id.includes("#" + name))?.id;
    assert.ok(id, name + ": " + JSON.stringify(dom.symbols?.map((s) => s.id)));
    assert.ok(server.code.includes(JSON.stringify(id)), name + " id on the server: " + id);
  }
});

test("definitions per environment; island modules (dev accept only in dev)", () => {
  const exports = [
    { name: "Counter", component: true },
    { name: "default", component: true },
    { name: "x", component: false },
  ];
  assert.equal(
    serverDefs("virtual:rivet-island-pure:/a/C.react.tsx", "src/C.react.tsx", "@rivetjs/bridge-react/server", exports),
    `import * as M from "virtual:rivet-island-pure:/a/C.react.tsx";
import { adapter } from "@rivetjs/bridge-react/server";
export const Counter = { id: "src/C.react.tsx#Counter", c: M["Counter"], a: adapter, chunk: "src/C.react.tsx#Counter" };
export const _default = { id: "src/C.react.tsx#default", c: M["default"], a: adapter, chunk: "src/C.react.tsx#default" };
export { _default as default };
`,
  );
  assert.equal(
    clientDefs("src/C.react.tsx", exports),
    `export const Counter = { id: "src/C.react.tsx#Counter" };\nexport const _default = { id: "src/C.react.tsx#default" };\nexport { _default as default };\n`,
  );
  assert.equal(clientDefs("src/C.react.tsx", [{ name: "x", component: false }]), "export {};\n");
  const prod = islandModule("virtual:rivet-island-pure:/a/C.react.tsx", "src/C.react.tsx", "Counter", "@rivetjs/bridge-react/client", false);
  assert.equal(
    prod,
    `export { Counter as default } from "virtual:rivet-island-pure:/a/C.react.tsx";\nexport { adapter } from "@rivetjs/bridge-react/client";\nexport const __rivetIsland = "src/C.react.tsx#Counter";\n`,
  );
  assert.doesNotMatch(prod, /import\.meta\.hot|__rivetBridgeDev/);
  assert.match(
    islandModule("t", "k", "default", "a", true),
    /^export \{ default \} from "t";[\s\S]*import\.meta\.hot\.accept[\s\S]*__rivetBridgeDev\?\.replace/,
  );
});
