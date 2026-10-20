// Server suite for resource() (ordered renders). Run by ../resource.test.ts through the register hook.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Api, Chain, Failing, Siblings, Unwaited, Waiting } from "./components.tsx";

const id = (n: number | null) => (() => n) as never;

test("a Suspense waits for the resources its content reads; the fetcher runs once", async () => {
  const api = new Api();
  api.answer = async (key) => "user " + String(key);
  const html = await renderToString(() => <Waiting id={id(4)} api={api} />);
  assert.equal(html, '<main><p class="profile"><b>user 4</b><i>ready</i><u>idle</u></p></main>');
  assert.equal(api.calls.length, 1, "the rebuilt content reuses the resource");
});

test("sibling resources load in parallel (one rebuild); a dependent one loads after its source", async () => {
  const a = new Api(),
    b = new Api();
  a.answer = async () => "A";
  b.answer = async () => "B";
  const html = await renderToString(() => <Siblings a={a} b={b} />);
  assert.match(html, /<b>A<\/b>.*<b>B<\/b>/);
  assert.equal(a.calls.length + b.calls.length, 2);
  const first = new Api(),
    other = new Api();
  first.answer = async () => "x";
  other.answer = async (key) => "dep(" + String(key) + ")";
  assert.equal(await renderToString(() => <Chain api={first} other={other} />), "<p>x/dep(x!)</p>");
  assert.equal(first.calls.length, 1);
  assert.equal(other.calls.length, 1);
  assert.equal(other.calls[0]!.key, "x!");
});

test("a failed load reaches the ErrorBoundary", async () => {
  const api = new Api();
  api.answer = () => Promise.reject(new Error("down"));
  assert.equal(await renderToString(() => <Failing api={api} />), '<p class="caught">down</p>');
});

test("outside Suspense the server renders the loading state; ssr: false never fetches", async () => {
  const api = new Api();
  api.answer = async () => "late";
  assert.equal(await renderToString(() => <Unwaited api={api} />), "<p><b>-</b><i>pending</i></p>");
  assert.equal(api.calls.length, 1);
  const off = new Api();
  assert.equal(await renderToString(() => <Unwaited api={off} ssr={false} />), "<p><b>-</b><i>pending</i></p>");
  assert.equal(off.calls.length, 0);
  // Synchronous answers need no Suspense.
  const now = new Api();
  now.answer = () => "now";
  assert.equal(await renderToString(() => <Unwaited api={now} />), "<p><b>now</b><i>ready</i></p>");
});
