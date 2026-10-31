import { afterEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import * as chat from "../chat/index.tsx";

afterEach(() => vi.unstubAllGlobals());

function clock() {
  let now = 0;
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => (frames.set(++id, fn), id));
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
  vi.stubGlobal("performance", { now: () => now });
  return {
    step(ms: number) {
      now += ms;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn(now));
    },
    pending: () => frames.size,
  };
}

test("text reveal: bursts progress within words and drain after input ends", () => {
  const c = clock();
  const source = signal("");
  const target = signal("");
  const streaming = signal(true);
  const active: boolean[] = [];
  const stop = chat.followText(source, target, { speed: 20, isStreaming: streaming, onRevealingChange: (value) => active.push(value) });
  source.set("Hello");
  assert.equal(target(), "");
  c.step(50);
  assert.equal(target(), "H");
  source.set("Hello there");
  streaming.set(false);
  c.step(50);
  assert.equal(target().startsWith("H"), true);
  assert.equal(target().length < "Hello there".length, true);
  c.step(240);
  assert.equal(target(), "Hello there");
  assert.equal(c.pending(), 0);
  assert.deepEqual(active, [true, false]);
  stop();
});

test("text reveal: complete graphemes, split surrogate input and bounded catch-up", () => {
  const c = clock();
  const source = signal("");
  const target = signal("");
  const stop = chat.followText(source, target, { speed: 20, isStreaming: () => true });
  source.set("\ud83d");
  c.step(50);
  assert.equal(target(), "");
  source.set("👩🏽‍💻é!");
  c.step(50);
  assert.equal(target(), "👩🏽‍💻");
  c.step(50);
  assert.equal(target(), "👩🏽‍💻é");
  source.set("👩🏽‍💻é!" + "a".repeat(1000));
  c.step(240);
  assert.equal(target(), source());
  stop();
});

test("text reveal: reset discards the old queue, static changes are immediate, disposal cancels frames", () => {
  const c = clock();
  const source = signal("Existing");
  const target = signal("Existing");
  const streaming = signal(true);
  const stop = chat.followText(source, target, { isStreaming: streaming });
  source.set("Existing text");
  source.set("");
  assert.equal(target(), "");
  assert.equal(c.pending(), 0);
  streaming.set(false);
  source.set("Replacement");
  assert.equal(target(), "Replacement");
  streaming.set(true);
  source.set("Replacement more");
  assert.equal(c.pending(), 1);
  stop();
  c.step(1000);
  assert.equal(target(), "Replacement");
  assert.equal(c.pending(), 0);
});

test("text reveal: speed zero and reduced motion bypass the queue", () => {
  const c = clock();
  for (const reduced of [false, true]) {
    vi.stubGlobal("matchMedia", () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }));
    const source = signal("");
    const target = signal("");
    const stop = chat.followText(source, target, { isStreaming: () => true, speed: reduced ? 80 : 0 });
    source.set("Immediately visible");
    assert.equal(target(), "Immediately visible");
    assert.equal(c.pending(), 0);
    stop();
  }
});

test("text reveal: enabling reduced motion flushes pending text and releases the listener", () => {
  const c = clock();
  let change: (() => void) | undefined;
  const media = {
    matches: false,
    addEventListener(_name: string, fn: () => void) {
      change = fn;
    },
    removeEventListener() {
      change = undefined;
    },
  };
  vi.stubGlobal("matchMedia", () => media);
  const source = signal("");
  const target = signal("");
  const stop = chat.followText(source, target, { isStreaming: () => true });
  source.set("A pending burst");
  media.matches = true;
  change!();
  assert.equal(target(), "A pending burst");
  assert.equal(c.pending(), 0);
  stop();
  assert.equal(change, undefined);
});
