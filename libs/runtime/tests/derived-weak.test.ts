// Weak boundaries (ZERO Z3): `_rWeak()` marks the boundary rendering it weak (the router's generated `Root` / `App` with the
// client router off). A render whose first flush keeps only weak records ships nothing (no tail, loader or runtime); one
// that also keeps a boundary that is not weak ships every record as before.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";

const source = `
import { _rB, _rBOut, _rBEnd, _rSig } from "@rivetjs/runtime/server-derived";
import { _rWeak } from "@rivetjs/runtime/derived-eager";
export function Shell(props) {
  const B = _rB("Shell", 0, undefined, "click");
  try {
    _rWeak();
    return _rBOut(B, <div onClick={() => undefined}>{props.children}</div>);
  } finally {
    _rBEnd(B);
  }
}
export function Counter() {
  const B = _rB("Counter", 0, undefined, "click");
  try {
    const n = _rSig("c-0", 0);
    return _rBOut(B, <button onClick={() => n.set(n() + 1)}>{n()}</button>);
  } finally {
    _rBEnd(B);
  }
}
export function Inert() {
  return <Shell><p>static</p></Shell>;
}
export function Live() {
  return <Shell><Counter /></Shell>;
}
`;
const manifest = { hash: "t", runtime: "/rt.js", symbols: { Shell: "/page.js", Counter: "/page.js", Inert: "/page.js", Live: "/page.js" } };
type Mod = Record<"Inert" | "Live", () => ServerValue>;

async function server(): Promise<Mod> {
  const out = compile(source, { target: "server", filename: "weak.server.tsx" });
  assert.deepEqual(out.diagnostics, []);
  return importServer<Mod>(out.code);
}

test("server: a render whose records are all weak ships no tail, loader or runtime", async () => {
  const { Inert } = await server();
  const html = (await derivedToString(() => Inert(), { manifest })) as string;
  assert.ok(!html.includes("rivet/boundaries"), html);
  assert.ok(!html.includes("<script"), html);
  assert.match(html, /<p>static<\/p>/);
});

test("server: a kept boundary that is not weak keeps the weak records with it", async () => {
  const { Live } = await server();
  const html = (await derivedToString(() => Live(), { manifest })) as string;
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  assert.deepEqual(
    tail.b.map((r: unknown[]) => r.slice(0, 2).concat(r[3])),
    [
      [1, 0, "Shell"],
      [2, 1, "Counter"],
    ],
  );
  assert.match(html, /data-rt="\/rt\.js"/);
});
