import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";

// FLATTEN-CMP-3: keyed `<For>` rows lower to a list mount on the server (no resume: this file never loads
// server-resume, so the runtime For has no row hook). Differential against `serverListMounts: false`.
type Mod = { Page(p: unknown): unknown; renderToString(v: unknown): string | Promise<string> };
let serial = 0;
async function load(source: string, lists: boolean) {
  const r = compile(source, { target: "server", filename: "for.tsx", serverListMounts: lists });
  assert.deepEqual(r.diagnostics, []);
  const mod = await importServer<Mod>(r.code + `\nexport { renderToString } from "@rivetjs/runtime/server";\n// ${serial++}`);
  return { code: r.code, mod };
}
const settle = async (run: () => unknown) => {
  try {
    return { value: await run() };
  } catch (error) {
    return { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
};
async function same(source: string, inputs: unknown[]) {
  const [plain, lists] = [await load(source, false), await load(source, true)];
  assert.doesNotMatch(plain.code, /\$list/);
  assert.match(lists.code, /"\$list": \[/);
  for (const input of inputs) {
    const a = await settle(() => plain.mod.renderToString(plain.mod.Page(input)));
    const b = await settle(() => lists.mod.renderToString(lists.mod.Page(input)));
    assert.deepEqual(b, a, JSON.stringify(input));
  }
  return lists.code;
}
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i, name: `n<${i}>`, href: i === 1 ? "javascript:x" : `/r/${i}` }));

test("3: native row body with item + index getters", async () => {
  const code = await same(
    `import { For } from "@rivetjs/runtime/server";
export function Page(p: { rows: { id: number; name: string; href: string }[] }) {
  return <ul><For each={() => p.rows} by={(r) => r.id}>{(row, i) => <li data-i={i()} class={row().id % 2 ? "odd" : undefined}><a href={row().href}>{row().name}</a>{i() === 0 ? <b>first</b> : null}</li>}</For></ul>;
}`,
    [
      { rows: [] },
      { rows: rows(3) },
      {
        rows: [
          { id: 1, name: "a" },
          { id: 1, name: "b" },
        ],
      },
      { rows: "nope" },
    ],
  );
  assert.match(code, /let row = \(\) => __rivetItem;\s*let i = \(\) => __rivetAt;/);
});

test("3: twin component rows (flattened nested component), throwing rows, holes", async () => {
  const source = `import { For } from "@rivetjs/runtime/dom";
function Cell({ v }: { v: unknown }) { return <td>{String(v)}</td>; }
function Row({ row }: { row: { id: number; name: string } }) {
  if (row.name === "boom") throw new Error("row failed");
  return <tr data-id={row.id}><Cell v={row.name} /><td>{row.id}</td></tr>;
}
export function Page(p: { rows: unknown[] }) {
  return <table><tbody><For each={() => p.rows} by={(r: any, i) => r?.id ?? "k" + i}>{(row) => <Row row={row()} />}</For></tbody></table>;
}`;
  const sparse: unknown[] = [{ id: 1, name: "a" }];
  sparse[2] = { id: 3, name: "c" };
  const code = await same(source, [
    { rows: rows(4) },
    {
      rows: [
        { id: 1, name: "a" },
        { id: 2, name: "boom" },
      ],
    },
    { rows: sparse },
  ]);
  assert.match(code, /Row__rivetTape\(__rivetTape\w*, __rivetBase\w*, row\(\)\)/);
});

test("3: ineligible For shapes keep the generic rows", () => {
  for (const body of [
    `{(row) => { return <li>{row()}</li>; }}`, // block body
    `{(row) => <li {...row()} />}`.replace("<li", "<Spread").replace("/>", "/>"), // component with spread
    `{(row) => <li>{row()}</li>}{" "}x`, // more children
  ]) {
    const r = compile(
      `import { For } from "@rivetjs/runtime/server";\nconst Spread = (p: any) => <i {...p} />;\nexport const Page = (p: any) => <ul><For each={() => p.rows} by={(r: any) => r}>${body}</For></ul>;`,
      {
        target: "server",
        filename: "for.tsx",
      },
    );
    assert.doesNotMatch(r.code, /\$list/, body);
  }
});
