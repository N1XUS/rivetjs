// Shell cache H-holes (PPR-T6): the compiler's eligibility fact per streamed boundary (`moduleFacts(…, { holes: true })`)
// and the server resume target's `$hole: 1` mark on eligible `<Async>` elements (`rust/src/holes.rs`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, moduleFacts } from "../index.ts";

const head = `
import { signal, createStore } from "@rivetjs/reactivity";
import { Async, Suspense } from "@rivetjs/runtime/dom";
import { session } from "./session.ts";
const NAV = ["a", "b"];
`;
const holes = (body: string) => moduleFacts(head + body, "src/routes/_layout.tsx", { holes: true }).holes!;
const because = (body: string) => holes(body).map((h) => h.because);

test("holes: an Async whose thunks capture props, module refs, globals and data consts is eligible", () => {
  const facts = holes(`
export default function Layout({ data }: { data: () => Promise<{ user: string }> }) {
  const label = { text: "Signed in as", nav: NAV, n: NAV.length + 1 };
  const prefix = label.text;
  return <header><Async load={() => data()} fallback={() => <i>…</i>}>{(v) => <b title={prefix} data-n={label.n}>{v.user}{JSON.stringify(NAV)}{session}</b>}</Async></header>;
}`);
  assert.equal(facts.length, 1);
  assert.deepEqual({ ...facts[0], at: 0 }, { component: "Layout", tag: "Async", at: 0, line: 10, column: 18, eligible: true, because: null });
});

test("holes: non-data captures, missing fallback, Suspense and reactive state make a boundary ineligible", () => {
  const cases: [string, RegExp][] = [
    [
      `export function A(props) { const t = props.translate(); return <Async load={() => props.data()} fallback={() => null}>{(v) => <b>{t(v)}</b>}</Async>; }`,
      /captures `t`, a `const` not initialised by data/,
    ],
    [
      `export function A(props) { let n = 1; return <Async load={() => props.data()} fallback={() => null}>{(v) => <b>{n}</b>}</Async>; }`,
      /captures `n`, a `let`/,
    ],
    [
      `export function A(props) { const f = (x) => x; return <Async load={() => props.data()} fallback={() => null}>{(v) => <b>{f(v)}</b>}</Async>; }`,
      /captures `f`, a `const` not initialised by data/,
    ],
    [
      `export function A(props) { function f(x) { return x; } return <Async load={() => props.data()} fallback={() => null}>{(v) => <b>{f(v)}</b>}</Async>; }`,
      /local function \/ class `f`/,
    ],
    [
      `export function A(props) { const open = signal(false); return <Async load={() => props.data()} fallback={() => null}>{(v) => <b>{v}</b>}</Async>; }`,
      /creates reactive state \(`signal`\)/,
    ],
    [
      `export function A(props) { const s = createStore({}); return <Async load={() => props.data()} fallback={() => null}>{(v) => <b>{v}</b>}</Async>; }`,
      /creates reactive state \(`createStore`\)/,
    ],
    [`export function A(props) { return <Async load={() => props.data()}>{(v) => <b>{v}</b>}</Async>; }`, /no `fallback`/],
    [`export function A(props) { return <Suspense fallback={() => null}><b /></Suspense>; }`, /`<Suspense>` boundary/],
    [`export function A(props) { return <Async {...props} fallback={() => null} />; }`, /spread props/],
  ];
  for (const [body, why] of cases) {
    const [reason] = because(body);
    assert.match(reason ?? "eligible", why, body);
  }
  // A signal made inside the thunk is the hole's own (fresh per hit): eligible.
  assert.deepEqual(
    because(
      `export function A(props) { return <Async load={() => props.data()} fallback={() => null}>{(v) => { const n = signal(v); return <b>{n()}</b>; }}</Async>; }`,
    ),
    [null],
  );
});

test("holes: the server resume target marks eligible Asyncs `$hole: 1`; the DOM target and plain server builds do not", () => {
  const source =
    head +
    `export function A(props) { return <main><Async load={() => props.data()} fallback={() => <i />}>{(v) => <b>{v}</b>}</Async><Async load={() => props.other()} fallback={() => <i />}>{(v) => { const n = signal(v); return <b>{n()}</b>; }}</Async></main>; }
export function B(props) { let n = 0; return <Async load={() => props.data()} fallback={() => <i />}>{(v) => <b>{n}</b>}</Async>; }`;
  const server = compile(source, { filename: "src/a.tsx", target: "server", resume: { module: "src/a.tsx" } }).code;
  assert.equal(server.match(/"\$hole": 1/g)?.length, 2);
  for (const options of [
    { filename: "src/a.tsx", target: "dom" as const, resume: { module: "src/a.tsx" } },
    { filename: "src/a.tsx", target: "server" as const },
  ])
    assert.doesNotMatch(compile(source, options).code, /\$hole/);
});
