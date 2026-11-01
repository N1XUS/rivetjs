import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { createRoot, signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { liveSource } from "../client/live-source.ts";

/** Minimal `EventSource` stand-in: records instances, lets the test dispatch open / message / error. */
class FakeSource extends EventTarget {
  static all: FakeSource[] = [];
  readyState = 0;
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly url: string;
  readonly init?: { withCredentials?: boolean };
  constructor(url: string, init?: { withCredentials?: boolean }) {
    super();
    this.url = url;
    this.init = init;
    FakeSource.all.push(this);
  }
  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  emit(data: string, type = "message") {
    this.dispatchEvent(new MessageEvent(type, { data }));
  }
  fail(readyState: 0 | 2) {
    this.readyState = readyState;
    this.onerror?.(new Event("error"));
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
}
const g = globalThis as { EventSource?: unknown };
const install = () => {
  FakeSource.all = [];
  g.EventSource = FakeSource;
};
afterEach(() => delete g.EventSource);
const flush = () => new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

test("liveSource: initial value until opened; no EventSource (server) → open is a no-op", () => {
  const source = liveSource("/events", { initial: 3 });
  assert.equal(source(), 3);
  assert.equal(source.status(), "connecting");
  const close = source.open();
  close();
  assert.equal(source(), 3);
  assert.equal(liveSource("/events")(), undefined);
});

test("liveSource: clientEffect opens it, events (parsed) update the value, disposal closes it once", async () => {
  install();
  const root = createRoot(() => {
    const source = liveSource("/events", { initial: 0, parse: (text) => (JSON.parse(text) as { n: number }).n });
    clientEffect(source.open);
    return source;
  });
  const source = root.value;
  assert.equal(FakeSource.all.length, 0, "opens after mount, not during render");
  await flush();
  assert.equal(FakeSource.all.length, 1);
  const es = FakeSource.all[0]!;
  assert.equal(es.url, "/events");
  assert.equal(es.init, undefined);
  assert.equal(source.status(), "connecting");
  es.open();
  assert.equal(source.status(), "open");
  es.emit('{"n":5}');
  assert.equal(source(), 5);
  // Named events are ignored unless asked for.
  es.emit('{"n":9}', "other");
  assert.equal(source(), 5);
  es.fail(0);
  assert.equal(source.status(), "connecting");
  es.fail(2);
  assert.equal(source.status(), "closed");
  root.dispose();
  assert.equal(es.closed, true);
  assert.equal(source.status(), "closed");
  assert.equal(FakeSource.all.length, 1);
});

test("liveSource: named event types, raw text parse, withCredentials, accessor URL reconnects", async () => {
  install();
  const url = signal("/a");
  const root = createRoot(() => {
    const source = liveSource(() => url(), { initial: "", parse: (text) => text, event: ["price", "stock"], withCredentials: true });
    clientEffect(source.open);
    return source;
  });
  await flush();
  const first = FakeSource.all[0]!;
  assert.deepEqual(first.init, { withCredentials: true });
  first.emit("ignored");
  assert.equal(root.value(), "");
  first.emit("1.5", "price");
  assert.equal(root.value(), "1.5");
  first.emit("in stock", "stock");
  assert.equal(root.value(), "in stock");
  url.set("/b");
  assert.equal(first.closed, true);
  assert.equal(FakeSource.all.length, 2);
  assert.equal(FakeSource.all[1]!.url, "/b");
  // Reading the value inside the source does not re-run the effect.
  FakeSource.all[1]!.emit("x", "price");
  assert.equal(FakeSource.all.length, 2);
  root.dispose();
  assert.equal(FakeSource.all[1]!.closed, true);
});
