// Session claims (agent/session.ts): a duplicated tab starts with a copy of sessionStorage — the same
// session — and must regenerate it before opening the pop-out channel, or both tabs answer one panel.
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { CLAIM_WAIT, claimSession } from "../agent/session.ts";

// In-memory BroadcastChannel: delivers to every other open channel of the same name, asynchronously.
class Bus {
  static open = new Set<Bus>();
  /** Delivery delay (ms); 0 = next microtask. */
  static delay = 0;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  readonly name: string;
  constructor(name: string) {
    this.name = name;
    Bus.open.add(this);
  }
  postMessage(data: unknown): void {
    for (const other of Bus.open)
      if (other !== this && other.name === this.name) {
        const deliver = () => other.onmessage?.({ data: structuredClone(data) });
        if (Bus.delay) setTimeout(deliver, Bus.delay);
        else queueMicrotask(deliver);
      }
  }
  close(): void {
    Bus.open.delete(this);
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("BroadcastChannel", Bus);
});
afterEach(() => {
  Bus.open.clear();
  Bus.delay = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const tab = (stored: string | null) => {
  const saved: string[] = [],
    listened: string[] = [];
  const session = claimSession({ stored, save: (id) => void saved.push(id), listen: (id) => void listened.push(id) });
  return { session, saved, listened };
};

test("a reload keeps its stored session; the pop-out channel opens after the claim wait", async () => {
  const a = tab("s1");
  assert.deepEqual(a.listened, [], "not listening before the claim settled");
  await vi.advanceTimersByTimeAsync(CLAIM_WAIT);
  assert.equal(a.session.id, "s1");
  assert.deepEqual(a.listened, ["s1"]);
});

test("a duplicated tab (copied session) regenerates it before listening; the original keeps it", async () => {
  const original = tab("s1");
  await vi.advanceTimersByTimeAsync(CLAIM_WAIT);
  const duplicate = tab("s1");
  await vi.advanceTimersByTimeAsync(CLAIM_WAIT);
  assert.equal(original.session.id, "s1");
  assert.notEqual(duplicate.session.id, "s1");
  assert.deepEqual(duplicate.listened, [duplicate.session.id], "only the fresh session was ever listened on");
  assert.equal(duplicate.saved.at(-1), duplicate.session.id, "the fresh session is stored for its reloads");
  assert.deepEqual(original.listened, ["s1"]);
});

test("an answer arriving after the channel opened re-listens on the regenerated session", async () => {
  const original = tab("s1");
  await vi.advanceTimersByTimeAsync(CLAIM_WAIT);
  // A slow channel: the claim's answer lands after the duplicate's wait elapsed.
  Bus.delay = CLAIM_WAIT;
  const duplicate = tab("s1");
  await vi.advanceTimersByTimeAsync(CLAIM_WAIT);
  assert.deepEqual(duplicate.listened, ["s1"], "opened on the copied session first");
  await vi.advanceTimersByTimeAsync(CLAIM_WAIT * 2);
  assert.notEqual(duplicate.session.id, "s1");
  assert.deepEqual(duplicate.listened, ["s1", duplicate.session.id], "then moved to a fresh one");
  assert.equal(original.session.id, "s1");
  assert.deepEqual(original.listened, ["s1"]);
});

test("new tabs (nothing stored) get distinct fresh sessions", async () => {
  const a = tab(null),
    b = tab(null);
  await vi.advanceTimersByTimeAsync(CLAIM_WAIT);
  assert.ok(a.session.id && b.session.id && a.session.id !== b.session.id);
  assert.deepEqual([a.listened.length, b.listened.length], [1, 1]);
});
