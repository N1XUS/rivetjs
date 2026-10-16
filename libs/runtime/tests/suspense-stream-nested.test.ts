// Streamed boundaries under scopes that end before them: a Suspense created inside a streamed segment (the content of a
// streamed Async or of an outer Suspense), a streamed boundary under an awaited Async or a Provider in the shell, an
// ErrorBoundary inside a Suspense segment. The render holding such a scope disposes it when it ends; the streamed
// boundary leaves it (`_detach`) and is disposed by its stream, once, after its own segment (and nested ones) are out —
// or, when its segment is dropped before its record was admitted (a throwing sibling) or the request ends early (abort,
// deadline, an uncaught throw), by its own disposer. A throwing fallback disposes the boundary at once. A streamed ErrorBoundary
// fallback renders under the boundary's (pinned) owner: it reads its context and is disposed when the stream ends.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderResumable } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

type ServerValue = ReturnType<Parameters<typeof renderResumable>[0]>;
type Entry = [number, unknown, number, number];
type Page =
  | "InAsync"
  | "InSuspense"
  | "UnderAwaited"
  | "UnderProvider"
  | "BoundaryInSuspense"
  | "ThrowingFallback"
  | "BareThrowingFallback"
  | "ThrowingSibling"
  | "UncaughtSibling";
const source = `
import { onCleanup, createContext, useContext } from "@rivetjs/reactivity";
import { Async, ErrorBoundary, Provider, Suspense } from "@rivetjs/runtime/server";
export const counts = { cleanups: 0, early: 0, fallbacks: 0 };
const T = createContext("none");
const later = (ms, value, fail) => new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error(value)) : resolve(value)), ms));
// The nested boundary's content: one cleanup, a load reading its signal (aborted only by its own disposal).
const inner = (mode) => {
  let done = false;
  onCleanup(() => counts.cleanups++);
  return mode === "plain" ? <b>plain</b> : <Async load={(work) => (work.signal.addEventListener("abort", () => done || counts.early++), later(5, "y", mode === "fail"))} fallback={() => <i>b</i>}>{(w) => ((done = true), <em>{w}</em>)}</Async>;
};
export function InAsync({ mode }) {
  return <section><Async load={() => later(5, "x")} fallback={() => <i>a</i>}>{(v) => <div>{v}<Suspense fallback={() => <i>n</i>}>{() => inner(mode)}</Suspense></div>}</Async></section>;
}
export function InSuspense({ mode }) {
  return <section><Suspense fallback={() => <i>o</i>}>{() => <Async load={() => later(5, "x")} fallback={() => <i>a</i>}>{(v) =>
    <div>{v}<Suspense fallback={() => <i>n</i>}>{() => inner(mode)}</Suspense></div>}</Async>}</Suspense></section>;
}
export function UnderAwaited({ mode }) {
  return <section><Async load={() => later(2, "x")}>{(v) => <div>{v}<Suspense fallback={() => <i>n</i>}>{() => inner(mode)}</Suspense></div>}</Async></section>;
}
export function UnderProvider({ mode }) {
  return <section><Provider token={T} value="p">{() => <div><Suspense fallback={() => <i>n</i>}>{() => inner(mode)}</Suspense></div>}</Provider></section>;
}
function Caught() {
  onCleanup(() => counts.fallbacks++);
  return <b>caught {useContext(T)}</b>;
}
export function BoundaryInSuspense({ mode }) {
  return <Provider token={T} value="p">{() => <section><Suspense fallback={() => <i>o</i>}>{() => <Async load={() => later(5, "x")} fallback={() => <i>a</i>}>{(v) =>
    <div>{v}<ErrorBoundary fallback={() => <Caught />}>{() => <div><Suspense fallback={() => <i>n</i>}>{() => inner(mode)}</Suspense></div>}</ErrorBoundary></div>}</Async>}</Suspense></section>}</Provider>;
}
export function ThrowingFallback({ mode }) {
  return <Provider token={T} value="p">{() => <section><ErrorBoundary fallback={() => <b>caught</b>}>{() => <div><Suspense fallback={() => { throw new Error("fallback"); }}>{() => inner(mode)}</Suspense></div>}</ErrorBoundary></section>}</Provider>;
}
export function BareThrowingFallback({ mode }) {
  return <section><ErrorBoundary fallback={() => <b>caught</b>}>{() => <div><Suspense fallback={() => { throw new Error("fallback"); }}>{() => inner(mode)}</Suspense></div>}</ErrorBoundary></section>;
}
function Boom() {
  throw new Error("sibling");
}
export function UncaughtSibling({ mode }) {
  return <Provider token={T} value="p">{() => {
    const view = <section><div><Suspense fallback={() => <i>n</i>}>{() => inner(mode)}</Suspense></div></section>;
    throw new Error("sibling " + typeof view);
  }}</Provider>;
}
export function ThrowingSibling({ mode }) {
  return <section><ErrorBoundary fallback={() => <b>caught</b>}>{() => <div><Suspense fallback={() => <i>n</i>}>{() => inner(mode)}</Suspense><Boom /></div>}</ErrorBoundary></section>;
}
`;
const symbols = compileResume(source, "dom").symbols;
const manifest = { runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((s) => [s.id, "/c.js"])) };
type Counts = { cleanups: number; early: number; fallbacks: number };
const mod = await importServer<Record<Page, (props: { mode: string }) => ServerValue> & { counts: Counts }>(compileResume(source, "server").code);
const settled = () => new Promise((resolve) => setTimeout(resolve, 30));
const render = async (page: Page, mode: string, options: { signal?: AbortSignal; deadline?: number } = {}) => {
  Object.assign(mod.counts, { cleanups: 0, early: 0, fallbacks: 0 });
  const chunks: string[] = [];
  let error: unknown;
  await Promise.resolve(
    renderResumable(
      () => mod[page]({ mode }),
      { write: (chunk) => void chunks.push(chunk) },
      { manifest, signal: options.signal, stream: { deadline: options.deadline } },
    ),
  ).catch((cause: unknown) => void (error = cause));
  // Loads still running when the stream ends (aborted, continued) settle; nothing is disposed twice meanwhile.
  await settled();
  const html = chunks.join("");
  const patches = [...html.matchAll(/<script type="rivet\/state" data-patch="\d+">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]!) as { a: Entry[] });
  return {
    html,
    // Boundary statuses in patch order: 0 pending (opened by that segment), 1 content, 2 continued in the browser, 3 a link.
    statuses: patches.flatMap((patch) => patch.a.map((entry) => entry[3])),
    templates: [...html.matchAll(/<template data-a="\d+">(.*?)<\/template>/gs)].map((match) => match[1]),
    counts: { ...mod.counts },
    error,
  };
};

for (const page of ["InAsync", "InSuspense"] as const) {
  test(`${page}: a nested Suspense with plain content renders in place, server-side`, async () => {
    const { html, statuses, templates, counts } = await render(page, "plain");
    assert.deepEqual(statuses, [1]);
    assert.deepEqual(templates, ["<div>x<b>plain</b></div>"]);
    assert.doesNotMatch(html, /<i>n<\/i>/);
    assert.deepEqual(counts, { cleanups: 1, early: 0, fallbacks: 0 });
  });

  test(`${page}: a nested Suspense with a pending Async streams its own segment, disposed once after it`, async () => {
    const { statuses, templates, counts } = await render(page, "pending");
    assert.deepEqual(statuses, [1, 0, 1], "outer content (the inner segment pending in it), then the inner content");
    assert.match(templates[0]!, /^<div>x<!--r\d+\[--><!--r\d+\[--><i>n<\/i><!--\]--><!--\]--><\/div>$/);
    assert.equal(templates[1], "<em>y</em>");
    assert.deepEqual(counts, { cleanups: 1, early: 0, fallbacks: 0 }, "the inner load is not aborted before its content rendered; disposed exactly once");
  });

  test(`${page}: a failing Async in the nested Suspense continues only the inner segment`, async () => {
    const { statuses, templates, counts } = await render(page, "fail");
    assert.deepEqual(statuses, [1, 0, 2], "only the inner segment continues in the browser");
    assert.equal(templates.length, 1, "the outer content");
    assert.equal(counts.cleanups, 1);
  });
}

for (const page of ["UnderAwaited", "UnderProvider"] as const)
  test(`${page}: a streamed Suspense in the shell outlives the scope around it`, async () => {
    const { statuses, templates, counts } = await render(page, "pending");
    assert.deepEqual(statuses, [1]);
    assert.deepEqual(templates, ["<em>y</em>"]);
    assert.deepEqual(counts, { cleanups: 1, early: 0, fallbacks: 0 });
  });

test("ErrorBoundary inside a Suspense segment: a failing nested segment renders the fallback as a segment", async () => {
  const { statuses, templates, counts } = await render("BoundaryInSuspense", "fail");
  assert.deepEqual(statuses, [1, 0, 3, 1, 1], "outer content + inner pending + boundary link, then the fallback for both");
  assert.match(templates[1]!, /^<b>caught (<!--[^>]*-->)?p(<!--[^>]*-->)?<\/b>$/, "the fallback reads the context around its boundary");
  assert.equal(counts.cleanups, 1);
  assert.equal(counts.fallbacks, 1, "the fallback's owner (the boundary's pin) is disposed once, when the stream ends");
});

test("ErrorBoundary inside a Suspense segment: a resolving nested segment streams its content", async () => {
  const { statuses, templates } = await render("BoundaryInSuspense", "pending");
  assert.deepEqual(statuses, [1, 0, 3, 1]);
  assert.equal(templates[1], "<em>y</em>");
});

test("request abort mid-stream: every streamed root is disposed exactly once", async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("gone")), 8);
  const { statuses, counts } = await render("InSuspense", "pending", { signal: controller.signal });
  assert.deepEqual(statuses, [1, 0], "the outer content went out, the inner segment did not");
  assert.equal(counts.cleanups, 1);
  assert.equal(counts.early, 1, "the inner load is aborted with the request");
});

test("deadline: a nested segment still pending continues in the browser, its root disposed once", async () => {
  const { statuses, counts } = await render("InSuspense", "pending", { deadline: 8 });
  assert.deepEqual(statuses, [1, 0, 2]);
  assert.equal(counts.cleanups, 1);
});

for (const page of ["ThrowingFallback", "BareThrowingFallback"] as const)
  test(`${page}: a throwing Suspense fallback disposes the boundary once, under a Provider or no owner at all`, async () => {
    const { html, counts, error } = await render(page, "pending");
    assert.equal(error, undefined);
    assert.match(html, /<b>caught<\/b>/);
    assert.equal(counts.cleanups, 1);
    assert.equal(counts.early, 1, "its pending load is aborted");
  });

// The throw reaches `renderResumable` as a rejected shell (traversal turns throws into rejections; a synchronous
// `factory()` throw happens before any boundary can be claimed), which abandons the stream as its sync catch does.
test("a throw out of the page (no ErrorBoundary) abandons the stream: the streamed root is disposed once", async () => {
  const { error, counts } = await render("UncaughtSibling", "pending");
  assert.match(String(error), /sibling/);
  assert.equal(counts.cleanups, 1);
  assert.equal(counts.early, 1, "its pending load is aborted");
});

test("a sibling throwing after a deferred Suspense drops its segment: the root is disposed once by its own disposer", async () => {
  const { html, statuses, counts, error } = await render("ThrowingSibling", "pending");
  assert.equal(error, undefined);
  assert.match(html, /<b>caught<\/b>/);
  assert.deepEqual(statuses, [], "no segment streams");
  assert.equal(counts.cleanups, 1);
});
