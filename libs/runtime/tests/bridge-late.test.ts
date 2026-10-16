// Function Bridge T5: `_rFn` captures given as a thunk are read once, at encode time (hoisted registrations, TDZ).
import { test } from "vitest";
import assert from "node:assert/strict";
import { _rFn, _rSpread, _rId, _rChild, _rEffect, resumableToString, renderResumable } from "@rivetjs/runtime/server-resume";
import { compiledTemplate } from "@rivetjs/runtime/server";
import { signal } from "@rivetjs/reactivity";
import { roundTrip } from "./resume/bridge-encode.ts";
import { compileResume, importServer } from "./resume/compile.ts";
import { readable } from "./resume/wire.ts";

interface State {
  t: unknown[];
  e: Record<string, Record<string, [symbol: string, refs: number[]]>>;
  b: unknown[][];
}
// Render `make()` resumably (manifest = `ids`) → readable state.
async function render(ids: string[], make: () => unknown): Promise<State> {
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries(ids.map((id) => [id, "/c.js"])) };
  const html = (await resumableToString(make as never, { manifest })) as string;
  return readable(JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) as never;
}
const BUTTON = Object.freeze(["<button", "", ">+</button>"]);
const DIV = Object.freeze(["<div>", "</div>"]);

test("thunk captures see values assigned after registration, and run once", async () => {
  let reads = 0;
  const { values } = await roundTrip(
    () => {
      let label = "early";
      const f = _rFn(
        "m.tsx#P$f",
        () => label,
        () => (reads++, [label]),
      );
      label = "late";
      return [f, { f }];
    },
    { "m.tsx#P$f": (label: never) => "revived:" + label },
  );
  assert.equal(values[0], "revived:late");
  assert.equal((values[1] as { f: unknown }).f, values[0]);
  assert.equal(reads, 1);
});

test("a throwing thunk fails the render naming the recipe id", async () => {
  await assert.rejects(
    roundTrip(() => {
      const f = _rFn(
        "m.tsx#P$g",
        () => 1,
        () => {
          throw new ReferenceError("Cannot access 'x' before initialization");
        },
      );
      return [f];
    }),
    (error: Error) => /m\.tsx#P\$g: captures Cannot access/.test(error.message) && (error.cause as Error).cause instanceof ReferenceError,
  );
});

test("no recorder: the thunk is never called", () => {
  let reads = 0;
  const fn = () => 1;
  assert.equal(
    _rFn("m.tsx#P$h", fn, () => (reads++, [])),
    fn,
  );
  assert.equal(reads, 0);
});

test("spread handler of a hoisted function: captures read at encode, not while the body still has them in TDZ", async () => {
  // T6 emission shape: `function bump(){ n.set(n() + 1) }` registered at the body top, `n` declared after `view`.
  let reads = 0;
  const [BUMP, SPREAD, FX] = ["m.tsx#P$bump", "m.tsx#P$spread", "m.tsx#P$fx"];
  const state = await render([BUMP, SPREAD, FX], () => {
    const bump = _rFn(
      BUMP,
      function bump() {
        n.set(n() + 1);
      },
      () => (reads++, [n]),
    );
    const attrs = { onClick: bump };
    const view = compiledTemplate(BUTTON, [_rSpread(SPREAD, () => ({ ...attrs }), [attrs], "button"), _rId()]);
    const n = signal(5);
    // A second reach path to the same recipe (an effect capture): one thunk call, one interned capture list.
    _rEffect(FX, [{ bump }]);
    return view as never;
  });
  const [symbol, refs] = state.e[0]!.click!;
  assert.equal(symbol, BUMP);
  assert.deepEqual(state.t[refs[0]!], { s: state.t.indexOf(5) });
  assert.equal(reads, 1);
});

test("symbol child (`_rChild`): captures its body never reads are read at encode", async () => {
  const [SLOT] = ["m.tsx#P$slot"];
  const state = await render([SLOT], () => {
    const s = signal(1);
    const slot = _rFn(
      SLOT,
      () => String(s()),
      () => [s, later],
    );
    const view = compiledTemplate(DIV, [_rChild(slot)]);
    const later = "late";
    return view as never;
  });
  const binding = state.b.find((entry) => entry[2] === SLOT)!;
  assert.equal(state.t[(binding[3] as number[])[1]!], "late");
});

test("a non-Error thunk throw names the thrown value", async () => {
  await assert.rejects(
    roundTrip(() => [
      _rFn(
        "m.tsx#P$k",
        () => 1,
        () => {
          throw "nope";
        },
      ),
    ]),
    (error: Error) => /m\.tsx#P\$k: captures nope/.test(error.message),
  );
});

// Streamed Suspense: the content's records (here a spread handler with late captures) move from the shell into the
// segment's recorder view; the segment settles them (its own `late` flag), a throwing thunk fails only the segment.
const SUSPENSE = `
import { Async, Suspense } from "@rivetjs/runtime/server";
const later = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
export function Page() {
  var label = "early"; // var: never a T8 cell, so the thunk itself reads the late value
  const attrs = { onClick: () => console.log(label) };
  const view = <section><Suspense fallback={() => <i>wait</i>}>{() => <><button {...attrs}>b</button><Async load={() => later(5, "x")} fallback={() => <i>a</i>}>{(v) => <em>{v}</em>}</Async></>}</Suspense></section>;
  label = "late";
  return view;
}
`;
interface Patch {
  a: number[][];
  e?: Record<string, Record<string, [number, number[]]>>;
  t: unknown[];
  t0: number;
}
async function streamed(captures: string, source = SUSPENSE): Promise<{ shell: { a: number[][]; t: unknown[] }; patch: Patch; patches: Patch[] }> {
  const symbols = compileResume(source, "dom").symbols;
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((symbol) => [symbol.id, "/c.js"])) };
  // T6 emission shape for the handler: its captures as a thunk (read at the segment's end, after `label = "late"`).
  const code = compileResume(source, "server").code.replace("() => console.log(label), [label])", "() => console.log(label), " + captures + ")");
  assert.ok(code.includes(captures));
  const mod = await importServer<{ Page(): never }>(code);
  const chunks: string[] = [];
  await renderResumable(() => mod.Page(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  const html = chunks.join("");
  const shell = JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  const patches = [...html.matchAll(/<script type="rivet\/state" data-patch="\d+">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]!) as Patch);
  return { shell, patch: patches[0]!, patches };
}
// The one spread `onClick` handler's captures in the patch that holds it.
const handlerCaptures = (patches: Patch[]): unknown[] => {
  const patch = patches.find((p) => p.e && Object.keys(p.e).length)!;
  const [[, refs]] = Object.values(Object.values(patch.e!)[0]!);
  return refs.map((ref) => patch.t[ref - patch.t0]);
};

test("streamed Suspense: a moved spread handler's late captures encode in the segment", async () => {
  const { shell, patch } = await streamed("() => [label]");
  assert.equal(patch.a[0]![3], 1, "segment content");
  const [[, refs]] = Object.values(Object.values(patch.e!)[0]!);
  assert.equal(refs.length, 1);
  // The Suspense region captures `attrs`, which ships by value in the shell (Q5 / T18) with its handler's late captures
  // read at the shell's end: the segment's ref may point into the shell table.
  const at = refs[0]!;
  assert.equal(at < patch.t0 ? shell.t[at] : patch.t[at - patch.t0], "late");
});

// Fix round 1 (T8 review L1): the `let` twin. The compiled `let` is a boxed cell (T8) captured eagerly (no thunk); the
// cell encodes once, at its first encode (the shell flush, after `Page` returned: `label = "late"` already ran), and the
// moved spread handler in the segment patch references it.
const SUSPENSE_LET = SUSPENSE.replace('var label = "early"; // var: never a T8 cell, so the thunk itself reads the late value', 'let label = "early";');

test("streamed Suspense, compiled let: the segment handler resumes over the boxed cell holding the late value", async () => {
  assert.notEqual(SUSPENSE_LET, SUSPENSE);
  assert.match(compileResume(SUSPENSE_LET, "server").code, /const label = __rivetR_cell\("early"\)/);
  const { shell, patches } = await streamed("[label]", SUSPENSE_LET);
  const patch = patches.find((p) => p.e && Object.keys(p.e).length)!;
  assert.equal(patch.a[0]![3], 1, "segment content");
  const [[, refs]] = Object.values(Object.values(patch.e!)[0]!);
  const table = (shell as unknown as { t: unknown[] }).t;
  const at = (ref: number): unknown => (ref < patch.t0 ? table[ref] : patch.t[ref - patch.t0]);
  const cell = at(refs[0]!) as { k: [string, number] };
  assert.equal(cell.k[0], "cell");
  assert.equal(at(cell.k[1]), "late");
  assert.doesNotMatch(JSON.stringify([shell, patches]), /"early"/);
});

test("streamed Suspense: a throwing late-capture thunk fails the segment (continued in the browser), not the stream", async () => {
  const { patch } = await streamed('() => { throw new Error("boom"); }');
  assert.equal(patch.a[0]![3], 2, "segment continues in the browser");
});

// A Suspense created inside a segment (the content of an Async in an outer Suspense's segment): its prepare moves the
// segment view's late records into its own view (T5 parked item). The inner Suspense root leaves the awaited Async that
// the outer segment's render disposes (`_detach`), so the inner segment settles on the server (fixed 2026-10-11; before,
// it always continued in the browser: `AbortError` from `server-async.ts` `live`). No segment fails; the late value encodes.
const NESTED = `
import { Async, Suspense } from "@rivetjs/runtime/server";
const later = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
export function Page() {
  var label = "early"; // var: never a T8 cell, so the thunk itself reads the late value
  const attrs = { onClick: () => console.log(label) };
  const view = <section><Suspense fallback={() => <i>o</i>}>{() => <Async load={() => later(5, "x")} fallback={() => <i>a</i>}>{(v) => <div>{v}<Suspense fallback={() => <i>n</i>}>{() => <><button {...attrs}>b</button><Async load={() => later(5, "y")} fallback={() => <i>b</i>}>{(w) => <em>{w}</em>}</Async></>}</Suspense></div>}</Async>}</Suspense></section>;
  label = "late";
  return view;
}
`;

test("streamed Suspense nested in a segment: a spread handler's late captures encode in the inner segment", async () => {
  const { patches } = await streamed("() => [label]", NESTED);
  assert.ok(patches.length >= 2, "outer and inner segments");
  assert.ok(
    patches.every((patch) => patch.a.every((entry) => entry[3] !== 2)),
    "no segment failed",
  );
  assert.deepEqual(handlerCaptures(patches), ["late"]);
});

// A streamed segment failing inside an ErrorBoundary: the fallback records into its own view, settled in `caught`.
const BOUNDARY = `
import { Async, ErrorBoundary } from "@rivetjs/runtime/server";
const fail = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("down")), ms));
export function Page() {
  var label = "early"; // var: never a T8 cell, so the thunk itself reads the late value
  const attrs = { onClick: () => console.log(label) };
  const view = <main><ErrorBoundary fallback={() => <button {...attrs}>retry</button>}>{() => <section><Async load={() => fail(5)} fallback={() => <i>a</i>}>{(v) => <em>{v}</em>}</Async></section>}</ErrorBoundary></main>;
  label = "late";
  return view;
}
`;

test("ErrorBoundary fallback of a failed segment: a spread handler's late captures encode in the fallback patch", async () => {
  const { patches } = await streamed("() => [label]", BOUNDARY);
  assert.equal(patches.length, 1, "the fallback segment");
  assert.deepEqual(handlerCaptures(patches), ["late"]);
});
