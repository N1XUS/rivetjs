// Function Bridge T26: reconstruct(() => value) — lazy, reactive, cleaned up on re-run; the encoder's refusals point at
// reconstruct (and registerClass for a class you cannot edit).
import { test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, onCleanup, signal } from "@rivetjs/reactivity";
import { reconstruct } from "@rivetjs/runtime/dom";
import { reconstruct as serverReconstruct } from "@rivetjs/runtime/server";
import { createEncoder } from "@rivetjs/runtime/resume-format";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

const DEV_RUN = process.execArgv.includes("--conditions=development");

test("the factory runs on first read, re-runs on a signal change and cleans up", () => {
  const url = signal("a");
  const log: string[] = [];
  createRoot(() => {
    const conn = reconstruct(() => {
      const u = url();
      log.push("open " + u);
      onCleanup(() => log.push("close " + u));
      return { u };
    });
    assert.deepEqual(log, []);
    assert.equal(conn().u, "a");
    url.set("b");
    assert.equal(conn().u, "b");
  });
  assert.deepEqual(log, ["open a", "close a", "open b"]);
  assert.equal(serverReconstruct(() => 3)(), 3);
});

test("a value is never compared: every re-run notifies (equals: false), and the server twin is lazy too", () => {
  const n = signal(1);
  let runs = 0;
  createRoot(() => {
    const same = reconstruct(() => (n(), "x"));
    const twin = serverReconstruct(() => (runs++, n()));
    assert.equal(runs, 0);
    assert.equal(twin(), 1);
    assert.equal(same(), "x");
  });
});

test("an unstamped function's error suggests reconstruct", () => {
  assert.throws(() => createEncoder().ref({ size: () => 1 }), /function is not serializable.*reconstruct\(/);
});

test("a class instance's error suggests reconstruct for your class and registerClass for a package class", () => {
  class Chart {
    size = 1;
  }
  assert.throws(
    () => createEncoder().ref({ chart: new Chart() }),
    /Chart instance is not serializable.*reconstruct\(\(\) => new Chart\(…\)\).*registerClass\(Chart, /,
  );

  // Built-ins keep the short message.
  assert.throws(() => createEncoder().ref({ p: Promise.resolve() }), /(^|: )Promise instance is not serializable$/);
});

test("a reconstruct reached through an alias is not compiled: the render refusal says to call reconstruct directly (dev hint, T27 review L1)", async () => {
  const source = `import { reconstruct } from "@rivetjs/runtime/dom";
const make = reconstruct;
export function Page() { const m = make(() => 1); return <b onClick={() => console.log(m())}>x</b>; }`;
  const server = await importServer<{ Page(): never }>(compileResume(source, "server", "src/p.tsx").code);
  const render = async () => resumableToString(() => server.Page(), { manifest: { hash: "h", runtime: "/rt.js", symbols: {} } });
  await assert.rejects(
    render,
    DEV_RUN
      ? /computed was not created in a resume-compiled component — .*call reconstruct\(\(\) => …\) directly in the component \(a `reconstruct` reached through a value or alias is not compiled\)/
      : /computed was not created in a resume-compiled component$/,
  );
});
