// Panel side of the protocol (ui/link.ts) over a fake pop-out BroadcastChannel: responses resolve by
// request id, `error.request` responses reject, and requests the agent never answers time out.
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { VERSION, type Envelope } from "../protocol.ts";

class FakeChannel {
  static last: FakeChannel | null = null;
  posted: unknown[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor() {
    FakeChannel.last = this;
  }
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
  close(): void {}
}
const requests = (channel: FakeChannel): Envelope[] => channel.posted.filter(Array.isArray).flat() as Envelope[];
const reply = (channel: FakeChannel, t: string, r: number, d: unknown) => channel.onmessage!({ data: [{ v: VERSION, s: 1, t, ts: 0, d, r }] });

beforeEach(() => {
  vi.stubGlobal("location", { hash: "#session" });
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  vi.stubGlobal("addEventListener", () => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function open() {
  const { connect } = await import("../ui/link.ts");
  const events: string[] = [];
  let connected = 0;
  const link = connect(
    (type) => void events.push(type),
    () => void connected++,
  );
  const channel = FakeChannel.last!;
  const hello = requests(channel).find((m) => m.t === "hello")!;
  reply(channel, "hello", hello.r!, { v: VERSION, mode: "serve", features: [], level: 2, session: "session" });
  await Promise.resolve();
  return { link, channel, events, connected: () => connected };
}

test("responses resolve the request of the same id; other envelopes are events", async () => {
  const { link, channel, events, connected } = await open();
  assert.equal(connected(), 1);
  const pending = link.request("tree.get", {});
  const sent = requests(channel).at(-1)!;
  assert.equal(sent.t, "tree.get");
  channel.onmessage!({ data: [{ v: VERSION, s: 2, t: "tree.changed", ts: 0, d: {} }] });
  reply(channel, "tree.get", sent.r!, []);
  assert.deepEqual(await pending, []);
  assert.deepEqual(events, ["tree.changed"]);
});

test("an error.request response rejects the request (never resolves with the error payload)", async () => {
  const { link, channel, events } = await open();
  const pending = link.request("owner.get", { id: 1 });
  reply(channel, "error.request", requests(channel).at(-1)!.r!, { message: "boom" });
  await assert.rejects(pending, (error: Error) => error.message === "owner.get: boom");
  assert.deepEqual(events, [], "the response is not an event");
}, 2000);

test("unanswered requests time out and reject; a late response is ignored", async () => {
  vi.useFakeTimers();
  const { link, channel, events } = await open();
  const pending = link.request("perf.get", {});
  const r = requests(channel).at(-1)!.r!;
  const settled = assert.rejects(pending, (error: Error) => /perf\.get: no response/.test(error.message));
  vi.advanceTimersByTime(30_000);
  await settled;
  reply(channel, "perf.get", r, {});
  assert.deepEqual(events, [], "late response dropped, not an event");
}, 2000);

test("panel store: an agent of another protocol version marks the panel stale and stops there", async () => {
  vi.stubGlobal("__RIVET_DEVTOOLS_BUILD__", "built");
  vi.stubGlobal("fetch", async () => ({ json: async () => ({ v: VERSION, hash: "built" }) }));
  vi.resetModules();
  const store = await import("../ui/store.ts");
  store.stale.set(null);
  store.start();
  const channel = FakeChannel.last!;
  const hello = requests(channel).find((m) => m.t === "hello")!;
  reply(channel, "hello", hello.r!, { v: VERSION + 1, mode: "serve", features: [], level: 2, session: "session" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(store.stale() ?? "", new RegExp("protocol v" + (VERSION + 1) + ", this panel v" + VERSION));
  assert.equal(store.connected(), false);
  assert.deepEqual(
    requests(channel).map((m) => m.t),
    ["hello"],
    "nothing else requested",
  );
});

test("panel store: a build older than the dev server's sources shows the rebuild banner", async () => {
  vi.stubGlobal("__RIVET_DEVTOOLS_BUILD__", "old");
  const fetched: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => (fetched.push(url), { json: async () => ({ v: VERSION, hash: "new" }) }));
  vi.resetModules();
  const store = await import("../ui/store.ts");
  store.stale.set(null);
  store.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(fetched, ["./__build"]);
  assert.match(store.stale() ?? "", /built from older sources/);
});

test("panel store: a current build stays quiet", async () => {
  vi.stubGlobal("__RIVET_DEVTOOLS_BUILD__", "same");
  vi.stubGlobal("fetch", async () => ({ json: async () => ({ v: VERSION, hash: "same" }) }));
  vi.resetModules();
  const store = await import("../ui/store.ts");
  store.stale.set(null);
  store.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.stale(), null);
});
