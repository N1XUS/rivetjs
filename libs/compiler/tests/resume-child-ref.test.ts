// A `children` reference child of a native element (`{props.children}`, `{children}`) is wrapped in `_rChild` on
// the resume server target (rt-slot-child 2026-10-08): a component's lone function child is its slot function, and
// `_rChild` renders an `_rFn` symbol as its own bind site so reads in its body re-run it after resume. Other
// references (`{item.name}`: list-row hot path) stay plain; the DOM target never wraps.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";

const resume = { module: "src/box.tsx" };
const source = `export function Box(props) {
  return <div class="box">{props.children}</div>;
}
export function Plain({ children, item }) {
  return <p>{children}{item.name}{(children as any)}</p>;
}`;

test("resume: children references render through _rChild on the server; other references stay plain", () => {
  const server = compile(source, { target: "server", filename: "box.tsx", resume });
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /_rChild as __rivetR_child/);
  assert.match(server.code, /__rivetR_child\(props\.children\)/);
  assert.equal([...server.code.matchAll(/__rivetR_child\(children\)/g)].length, 2);
  assert.doesNotMatch(server.code, /__rivetR_child\(item\.name\)/);
  const plain = compile(source, { target: "server", filename: "box.tsx" });
  assert.doesNotMatch(plain.code, /__rivetR_child/);
  const dom = compile(source, { target: "dom", filename: "box.tsx", resume });
  assert.doesNotMatch(dom.code, /__rivetR_child|_rChild/);
});
