import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { idleMemory, idleMemorySupported, type IdleMemoryOptions } from "../adapters/idle-memory.ts";
import { serve } from "../adapters/node.ts";

const MiB = 1024 * 1024;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** A controller over a fake heap; `heap.committed` is what the next check reads. */
function setup(options: IdleMemoryOptions = {}) {
  const heap = { committed: 20 * MiB };
  const state = { inflight: 0, nudges: 0 };
  const memory = idleMemory(() => state.inflight, {
    committed: () => heap.committed,
    nudge: () => {
      state.nudges++;
    },
    ...options,
  });
  const begin = () => {
    state.inflight++;
    memory.request();
  };
  const end = () => {
    if (--state.inflight === 0) memory.idle();
  };
  /** One complete request. */
  const hit = () => {
    begin();
    end();
  };
  return { heap, state, memory, begin, end, hit };
}

test("idle since boot: no timer at all", () => {
  setup();
  assert.equal(vi.getTimerCount(), 0);
  vi.advanceTimersByTime(600_000);
  assert.equal(vi.getTimerCount(), 0);
});

test("no timer while a request is in flight; the check after a busy period does not re-arm", () => {
  const { heap, state, begin, end } = setup();
  begin();
  assert.equal(vi.getTimerCount(), 0);
  heap.committed = 80 * MiB;
  end();
  assert.equal(vi.getTimerCount(), 1);
  begin(); // busy again before the quiet delay passed
  vi.advanceTimersByTime(1000);
  assert.equal(state.nudges, 0);
  assert.equal(vi.getTimerCount(), 0, "busy at check time: wait for the next idle()");
  end();
  assert.equal(vi.getTimerCount(), 1);
});

test("starts after a full quiet delay following pressure; one pending timer at most", () => {
  const { heap, state, hit } = setup();
  heap.committed = 80 * MiB;
  hit();
  hit();
  hit();
  assert.equal(vi.getTimerCount(), 1);
  vi.advanceTimersByTime(500);
  hit(); // traffic inside the delay: the check waits another full delay
  vi.advanceTimersByTime(500);
  assert.equal(state.nudges, 0);
  vi.advanceTimersByTime(999);
  assert.equal(state.nudges, 0);
  vi.advanceTimersByTime(1);
  assert.equal(state.nudges, 1);
});

test("no pressure (committed within V8's re-arm margin of the settled level): no nudge, timer ends", () => {
  const { heap, state, hit } = setup();
  heap.committed = 29 * MiB; // < 20 MiB + 10 MiB
  hit();
  vi.advanceTimersByTime(1000);
  assert.equal(state.nudges, 0);
  assert.equal(vi.getTimerCount(), 0);
});

test("stops once memory was returned and settles at the new level", () => {
  const { heap, state, hit } = setup();
  heap.committed = 80 * MiB;
  hit();
  vi.advanceTimersByTime(1000);
  assert.equal(state.nudges, 1);
  assert.equal(vi.getTimerCount(), 1, "re-check pending");
  heap.committed = 22 * MiB; // the memory reducer ran
  vi.advanceTimersByTime(17_000);
  assert.equal(state.nudges, 1);
  assert.equal(vi.getTimerCount(), 0);
  // Settled at 22 MiB: 31 MiB is not pressure, 33 MiB is.
  heap.committed = 31 * MiB;
  hit();
  vi.advanceTimersByTime(1000);
  assert.equal(state.nudges, 1);
  heap.committed = 33 * MiB;
  hit();
  vi.advanceTimersByTime(1000);
  assert.equal(state.nudges, 2);
});

test("retries every recheck while not shrunk, at most `attempts`, then accepts the heap", () => {
  const { heap, state, hit } = setup({ attempts: 3 });
  heap.committed = 80 * MiB;
  hit();
  vi.advanceTimersByTime(1000);
  vi.advanceTimersByTime(17_000 * 5);
  assert.equal(state.nudges, 3);
  assert.equal(vi.getTimerCount(), 0);
  // Settled at 80 MiB: the same level after more traffic is not pressure again.
  hit();
  vi.advanceTimersByTime(1000);
  assert.equal(state.nudges, 3);
});

test("a request during the re-check wait ends the episode", () => {
  const { heap, state, begin, end } = setup();
  heap.committed = 80 * MiB;
  begin();
  end();
  vi.advanceTimersByTime(1000);
  assert.equal(state.nudges, 1);
  begin();
  vi.advanceTimersByTime(17_000);
  assert.equal(state.nudges, 1, "busy at the re-check: no nudge");
  assert.equal(vi.getTimerCount(), 0);
  end(); // idle again: a fresh episode (full quiet delay)
  vi.advanceTimersByTime(999);
  assert.equal(state.nudges, 1);
  vi.advanceTimersByTime(1);
  assert.equal(state.nudges, 2);
});

test("timers are unref'd (never keep the process alive)", () => {
  vi.useRealTimers();
  const timers: NodeJS.Timeout[] = [];
  const real = globalThis.setTimeout;
  const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
    const timer = real(fn, ms);
    timers.push(timer);
    return timer;
  }) as typeof setTimeout);
  try {
    const memory = idleMemory(() => 0, { committed: () => 0, nudge: () => {} });
    memory.request();
    memory.idle();
    assert.equal(timers.length, 1);
    assert.equal(timers[0]!.hasRef(), false);
    memory.stop();
  } finally {
    spy.mockRestore();
  }
});

test("stop() clears the pending timer and later idle() calls arm nothing", () => {
  const { heap, state, memory, hit } = setup();
  heap.committed = 80 * MiB;
  hit();
  memory.stop();
  assert.equal(vi.getTimerCount(), 0);
  hit();
  vi.advanceTimersByTime(60_000);
  assert.equal(state.nudges, 0);
  assert.equal(vi.getTimerCount(), 0);
});

test("default nudge makes an embedder (cppgc) allocation on this Node", async () => {
  assert.equal(idleMemorySupported(), true);
  const { getCppHeapStatistics } = await import("node:v8");
  const used = () => (getCppHeapStatistics("detailed") as { used_size_bytes: number }).used_size_bytes;
  let committed = 0;
  const memory = idleMemory(() => 0, { committed: () => committed });
  committed = 1e9; // a spike
  memory.request();
  memory.idle();
  const before = used();
  vi.advanceTimersByTime(1000); // synchronous: no GC between the two reads
  const after = used();
  memory.stop();
  assert.ok(after > before, `vm.Script allocates a cppgc object (${before} -> ${after})`);
});

/** GET over a fresh connection, resolving once the response ended. */
const get = (url: string) =>
  new Promise<number>((done, fail) => {
    httpRequest(url, { agent: false }, (res) => {
      res.resume();
      res.on("end", () => done(res.statusCode ?? 0));
    })
      .on("error", fail)
      .end();
  });

test("node adapter: idleMemory: false arms no controller timer; the default arms one after a request", async () => {
  vi.useRealTimers();
  const handler = () => new Response("ok");
  const real = globalThis.setTimeout;
  let checks = 0;
  const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: (...args: unknown[]) => void, ms?: number) => {
    if (fn.name === "check") checks++;
    return real(fn, ms);
  }) as typeof setTimeout);
  try {
    const off = await serve({ handler, port: 0, idleMemory: false });
    try {
      assert.equal(await get(off.url + "/"), 200);
      await new Promise((done) => setImmediate(done));
      assert.equal(checks, 0);
    } finally {
      await off.close();
    }
    const on = await serve({ handler, port: 0 });
    try {
      assert.equal(await get(on.url + "/healthz"), 200);
      await new Promise((done) => setImmediate(done));
      assert.equal(checks, 0, "health probes are not traffic");
      assert.equal(await get(on.url + "/"), 200);
      await new Promise((done) => setImmediate(done));
      assert.equal(checks, 1);
    } finally {
      await on.close();
    }
  } finally {
    spy.mockRestore();
  }
});
