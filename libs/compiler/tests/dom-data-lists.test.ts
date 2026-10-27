import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { domListIn } from "../vite.ts";
import { _domSlots } from "../../runtime/server-derived-dom.ts";

// (The plugin rebuilds plans with `{ name }` slots only: what `_domSlots` reads.)
const slots = _domSlots as unknown as Parameters<typeof domListIn>[1];

// `resume.domData` ships only to builds with a keyed `<For>` whose rows show a value as whole text / a plain attribute
// (`vite.ts` `domListIn`, the runtime's `_domSlots` over the plan rebuilt from the server output).
const module = (row: string, extra = "") => `import { For } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
${extra}
function Cell(props: { v: string }) { return <b title={props.v}>{props.v}</b>; }
function Plain(props: { v: string }) { return <b class={props.v}>x</b>; }
export function List() {
  const items = signal([{ id: 1, label: "a", a: "x", b: "y" }]);
  return <ul><For each={() => items()} by={(r) => r.id}>{(r) => ${row}}</For></ul>;
}`;
const lists = (row: string, extra?: string) => {
  const out = compile(module(row, extra), { target: "server", filename: "/x/a.tsx", resume: { module: "a", boundaries: ["List"], independent: ["List"] } });
  assert.deepEqual(out.diagnostics, []);
  return domListIn(out.code, slots);
};

test("domListIn: rows with whole-text values or plain attributes qualify", () => {
  assert.equal(lists("<li>{r().label}</li>"), true);
  assert.equal(lists("<li data-id={r().id}><b>x</b></li>"), true);
  assert.equal(lists("<li><Cell v={r().label} /></li>"), true, "child component plan, flattened");
  assert.equal(lists("<Cell v={r().label} />"), true, "component row body");
});

test("domListIn: rows without DOM slots, and modules without list mounts, do not", () => {
  assert.equal(lists('<li class={"x" + r().id}><b>x</b></li>'), false);
  assert.equal(lists("<li>{r().a} - {r().b}</li>"), false, "two values in one text");
  assert.equal(lists("<li><Plain v={r().label} /></li>"), false);
  assert.equal(domListIn("export const x = 1;", slots), false);
});

test("domListIn: shapes it cannot read count as a hit", () => {
  const out = compile(module("<li>{r().label}</li>"), {
    target: "server",
    filename: "/x/a.tsx",
    resume: { module: "a", boundaries: ["List"], independent: ["List"] },
  });
  assert.equal(domListIn(out.code, null), true, "no runtime helper");
  assert.equal(domListIn('const x = { "$list": [other(), 1] };', slots), true, "unknown plan");
});
