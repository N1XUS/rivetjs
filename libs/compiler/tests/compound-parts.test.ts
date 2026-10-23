// Spike (HeroUI port plan 1): JSX member-expression components (`<Card.Header>`) — HeroUI's compound
// API (`Object.assign(Root, { Header, … })`) on 80 modules.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/m.tsx" };
const src = `import { signal } from "@rivetjs/reactivity";
import { Card } from "./card.tsx";
export function V() {
  const v = signal<"default" | "secondary">("default");
  return (
    <Card variant={v()} onClick={() => v.set("secondary")}>
      <Card.Header>
        <Card.Title>t</Card.Title>
      </Card.Header>
      <Card.Content>{v()}</Card.Content>
    </Card>
  );
}`;

for (const target of ["server", "dom"] as const) {
  test(`compound parts: ${target} compiles <Card.Header> as a component, no diagnostics`, () => {
    const out = compile(src, { target, filename: "m.tsx" });
    assert.deepEqual(out.diagnostics, []);
    // Member expressions stay component references (never lowered to a "card.header" element tag).
    assert.match(out.code, /Card\.Header/);
    assert.match(out.code, /Card\.Title/);
    assert.doesNotMatch(out.code, /<card\.header|"card\.header"/i);
  });
}

test("compound parts: nested namespace <Select.Popover><ListBox.Item> compiles", () => {
  const out = compile(
    `import { Select } from "./s.tsx"; import { ListBox } from "./l.tsx";
export const V = () => <Select><Select.Popover><ListBox><ListBox.Item id="a">A</ListBox.Item></ListBox></Select.Popover></Select>;`,
    { target: "dom", filename: "m.tsx" },
  );
  assert.deepEqual(out.diagnostics, []);
  assert.match(out.code, /ListBox\.Item/);
});
