import { test } from "vitest";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { eventStream, formatEvent } from "../sse.ts";
import { serve } from "../adapters/node.ts";

const decoder = new TextDecoder();
/** Reads chunks until `until` matches the text read so far (or the stream ends). */
async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, until: (text: string) => boolean, text = ""): Promise<string> {
  while (!until(text)) {
    const next = await reader.read();
    if (next.done) break;
    text += decoder.decode(next.value);
  }
  return text;
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("formatEvent: event / id fields, one data line per line, JSON for non-strings", () => {
  assert.equal(formatEvent("hi"), "data: hi\n\n");
  assert.equal(formatEvent({ n: 1 }, { event: "price", id: 7 }), 'event: price\nid: 7\ndata: {"n":1}\n\n');
  assert.equal(formatEvent("a\nb\r\nc\rd"), "data: a\ndata: b\ndata: c\ndata: d\n\n");
  assert.equal(formatEvent(""), "data: \n\n");
  assert.throws(() => formatEvent("x", { event: "a\nb" }), /line break/);
  assert.throws(() => formatEvent("x", { id: "1\n2" }), /line break/);
  assert.throws(() => formatEvent("x", { id: "1\u00002" }), /NUL/);
  assert.throws(() => formatEvent(undefined), /JSON value/);
});

test("eventStream: headers, retry first, events in order, close ends the body and runs cleanup once", async () => {
  const controller = new AbortController();
  let cleanups = 0;
  let close!: () => void;
  const response = eventStream(
    { signal: controller.signal },
    (send, end) => {
      send("one");
      send({ two: 2 }, { event: "tick", id: "a" });
      close = end;
      return () => void cleanups++;
    },
    { retry: 3000, heartbeat: false, headers: { "set-cookie": "a=1" } },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-cache, no-transform");
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  assert.equal(response.headers.get("set-cookie"), "a=1");
  close();
  close();
  controller.abort();
  assert.equal(await response.text(), 'retry: 3000\n\ndata: one\n\nevent: tick\nid: a\ndata: {"two":2}\n\n');
  assert.equal(cleanups, 1);
});

test("eventStream: the client going away (signal abort) stops the producer once; later sends return false", async () => {
  const controller = new AbortController();
  let cleanups = 0;
  let send!: (data: unknown) => boolean;
  const response = eventStream({ signal: controller.signal }, (s) => {
    send = s;
    return () => void cleanups++;
  });
  const reader = response.body!.getReader();
  assert.equal(await readUntil(reader, (t) => t.length > 0), ":\n\n");
  assert.equal(send("x"), true);
  controller.abort();
  controller.abort();
  assert.equal(cleanups, 1);
  assert.equal(send("y"), false);
  // The queued event still drains, then the body ends.
  assert.equal(await readUntil(reader, () => false), "data: x\n\n");
});

test("eventStream: cancelling the body runs cleanup once; cleanup returned after close runs at once", async () => {
  let cleanups = 0;
  const response = eventStream({ signal: new AbortController().signal }, () => () => void cleanups++, { heartbeat: false });
  await response.body!.cancel();
  await response.body!.cancel().catch(() => {});
  assert.equal(cleanups, 1);

  let late = 0;
  const closed = eventStream({ signal: new AbortController().signal }, (send, close) => {
    send("only");
    close();
    return () => void late++;
  });
  assert.equal(late, 1);
  assert.equal(await closed.text(), ":\n\ndata: only\n\n");
});

test("eventStream: an already aborted request never starts the producer", async () => {
  const controller = new AbortController();
  controller.abort();
  let started = false;
  const response = eventStream({ signal: controller.signal }, () => void (started = true));
  assert.equal(started, false);
  assert.equal(await response.text(), "");
});

test("eventStream: async producers — cleanup adopted on resolve, rejection errors the stream once", async () => {
  const controller = new AbortController();
  let cleanups = 0;
  const response = eventStream({ signal: controller.signal }, async (send) => {
    await tick();
    send("later");
    return () => void cleanups++;
  });
  const reader = response.body!.getReader();
  assert.match(await readUntil(reader, (t) => t.includes("later")), /data: later/);
  controller.abort();
  assert.equal(cleanups, 1);

  const failing = eventStream({ signal: new AbortController().signal }, async () => {
    await tick();
    throw new Error("upstream gone");
  });
  await assert.rejects(failing.text(), /upstream gone/);

  assert.throws(
    () =>
      eventStream({ signal: new AbortController().signal }, () => {
        throw new Error("sync");
      }),
    /sync/,
  );
  assert.throws(() => eventStream({ signal: new AbortController().signal }, () => {}, { retry: -1 }), /retry/);
});

test("eventStream: heartbeat comments while idle, stopped on close", async () => {
  const controller = new AbortController();
  const response = eventStream({ signal: controller.signal }, () => {}, { heartbeat: 5 });
  const reader = response.body!.getReader();
  const text = await readUntil(reader, (t) => t.split(":\n\n").length > 3);
  assert.match(text, /^(:\n\n){3,}$/);
  controller.abort();
  assert.match(await readUntil(reader, () => false), /^(:\n\n)*$/);
});

test("eventStream: backpressure — send returns false past highWaterMark, ready() resolves once the client reads", async () => {
  const controller = new AbortController();
  let send!: (data: unknown) => boolean;
  let ready!: () => Promise<void>;
  const response = eventStream(
    { signal: controller.signal },
    (s, _close, r) => {
      send = s;
      ready = r;
    },
    { heartbeat: false, highWaterMark: 64 },
  );
  const payload = "x".repeat(20);
  let sent = 0;
  while (send(payload)) sent++;
  assert.ok(sent >= 1 && sent < 4, `sent ${sent}`);
  let resumed = false;
  const waiting = ready().then(() => (resumed = true));
  await tick();
  assert.equal(resumed, false);
  const reader = response.body!.getReader();
  await readUntil(reader, (t) => t.split("data:").length - 1 > sent);
  await waiting;
  assert.equal(resumed, true);
  // Closed: ready() resolves at once.
  controller.abort();
  await ready();
});

test("node adapter: SSE events stream incrementally and uncompressed, cleanup runs when the client disconnects", async () => {
  let cleanups = 0;
  let disconnected!: () => void;
  const gone = new Promise<void>((resolve) => (disconnected = resolve));
  const serving = await serve({
    port: 0,
    handler: (request) =>
      eventStream(request, (send) => {
        let n = 0;
        const timer = setInterval(() => send({ n: ++n }, { id: n }), 40);
        return () => {
          clearInterval(timer);
          cleanups++;
          disconnected();
        };
      }),
  });
  try {
    const { hostname, port } = new URL(serving.url);
    const arrivals: { at: number; text: string }[] = [];
    const headers = await new Promise<Record<string, string | string[] | undefined>>((resolve, reject) => {
      const start = Date.now();
      const req = httpRequest({ hostname, port, path: "/events", headers: { "accept-encoding": "br, gzip, zstd" } }, (res) => {
        // Never hang: compressed (or held back) events never show "id: 3" in plain text.
        setTimeout(() => (resolve(res.headers), req.destroy()), 2000).unref();
        res.on("data", (chunk: Buffer) => {
          arrivals.push({ at: Date.now() - start, text: chunk.toString("utf8") });
          if (
            arrivals
              .map((a) => a.text)
              .join("")
              .includes("id: 3\n")
          ) {
            resolve(res.headers);
            req.destroy();
          }
        });
        res.on("error", () => {});
      });
      req.on("error", (error) => (arrivals.length ? undefined : reject(error)));
      req.end();
    });
    assert.equal(headers["content-encoding"], undefined);
    assert.equal(headers["content-length"], undefined);
    assert.match(String(headers["content-type"]), /^text\/event-stream/);
    const text = arrivals.map((a) => a.text).join("");
    assert.match(text, /^:\n\nid: 1\ndata: \{"n":1\}\n\nid: 2\ndata: \{"n":2\}\n\nid: 3\n/);
    // Each event is its own write, received at its own time (not collected into one body).
    const withEvents = arrivals.filter((a) => a.text.includes("data:"));
    assert.ok(withEvents.length >= 3, JSON.stringify(arrivals));
    assert.ok(withEvents[2]!.at - withEvents[0]!.at >= 50, JSON.stringify(arrivals));
    await gone;
    assert.equal(cleanups, 1);
  } finally {
    await serving.close();
  }
});
