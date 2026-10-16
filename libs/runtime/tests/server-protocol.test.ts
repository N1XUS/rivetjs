import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToWriter, template, compiledTemplate, attribute, Provider } from "../server.ts";
import { createContext, useContext, onCleanup, getOwner } from "@rivetjs/reactivity";
import { getEventListeners } from "node:events";
import type { ServerValue } from "../server.ts";

/** Opaque thenable fixtures: deliberately not structurally PromiseLike, but assimilated by the renderer. */
type Opaque = PromiseLike<string>;

/** Record current protocol output while blocking exactly one physical write acknowledgment. */
async function suspendAt(make: () => ServerValue, expected: string[], blocked: number) {
  const chunks: string[] = [];
  let release: (() => void) | undefined;
  const rendering = renderToWriter(make(), {
    write(chunk: string) {
      chunks.push(chunk);
      if (chunks.length - 1 === blocked)
        return new Promise<void>((done) => {
          release = done;
        });
    },
  });
  assert.deepEqual(chunks, expected.slice(0, blocked + 1));
  assert.equal(getOwner(), null);
  release!();
  await rendering;
  assert.deepEqual(chunks, expected);
}

test("protocol oracle resumes every compiled primitive flush at its next uncommitted atomic part", async () => {
  const scalar = "x".repeat(16 * 1024);
  const expected = ["<p>" + scalar, "|" + scalar, "</p>"];
  for (let blocked = 0; blocked < expected.length; blocked++) {
    await suspendAt(() => compiledTemplate(["<p>", "|", "</p>"], [scalar, scalar]), expected, blocked);
  }
});

test("protocol oracle mixed compiled/generic attributes preserve every physical acknowledgment boundary", async () => {
  const expected = ["<div>a", "<b", ' title="&lt;&amp;"', ">x</b>", "z</div>"];
  for (let blocked = 0; blocked < expected.length; blocked++) {
    await suspendAt(
      () => compiledTemplate(["<div>", "", "z</div>"], ["a", template(["<b", ">x</b>"], [attribute("title", "<&")])]),
      expected,
      blocked,
    );
  }
});

test("protocol oracle public regions capture length but read later slots and fragments after acknowledgment", async () => {
  const fragments = ["a", "c", "e"];
  const slots = ["b", "d"];
  const chunks: string[] = [];
  let release: (() => void) | undefined;
  const rendering = renderToWriter(template(fragments, slots), {
    write(chunk: string) {
      chunks.push(chunk);
      if (chunks.length === 1)
        return new Promise<void>((done) => {
          release = done;
        });
    },
  });
  slots[1] = "D";
  slots.push("ignored");
  fragments[1] = "C";
  release!();
  await rendering;
  assert.deepEqual(chunks, ["a", "b", "C", "D", "e"]);
});

test("protocol oracle admits opaque siblings once, scheduling then invocation with its original receiver", async () => {
  const log: string[] = [];
  let release: (() => void) | undefined;
  const sibling = {
    get then() {
      log.push("get then");
      return function (this: unknown, resolve: (value: string) => void) {
        assert.equal(this, sibling);
        log.push("invoke then");
        resolve("tail");
      };
    },
  };
  const chunks: string[] = [];
  const rendering = renderToWriter(compiledTemplate(["head", "", "end"], [sibling as Opaque, sibling as Opaque]), {
    write(chunk: string) {
      chunks.push(chunk);
      log.push("write:" + chunk);
      if (chunks.length === 1)
        return new Promise<void>((done) => {
          release = done;
        });
    },
  });
  assert.deepEqual(log, ["get then", "write:head"]);
  await Promise.resolve();
  assert.deepEqual(log, ["get then", "write:head", "invoke then"]);
  release!();
  await rendering;
  assert.deepEqual(chunks, ["head", "tail", "tail", "end"]);
  assert.equal(log.filter((x) => x === "get then").length, 1);
  assert.equal(log.filter((x) => x === "invoke then").length, 1);
});

test("protocol oracle a reused writer acknowledgment is normalized and awaited separately for each write", async () => {
  const log: string[] = [];
  const acknowledgment = {
    get then() {
      log.push("get ack");
      return function (this: unknown, resolve: () => void) {
        assert.equal(this, acknowledgment);
        log.push("invoke ack");
        resolve();
      };
    },
  };
  const rendering = renderToWriter(template(["a", "c"], ["b"]), {
    write(chunk: string) {
      log.push("write:" + chunk);
      return acknowledgment as PromiseLike<void>;
    },
  });
  assert.deepEqual(log, ["write:a", "get ack"]);
  await rendering;
  assert.deepEqual(log, [
    "write:a",
    "get ack",
    "invoke ack",
    "write:b",
    "get ack",
    "invoke ack",
    "write:c",
    "get ack",
    "invoke ack",
  ]);
});

test("protocol oracle owned coercion/writer continuations retain context and finalize once on failure", async () => {
  const token = createContext("default");
  const seen: string[] = [];
  let cleanup = 0,
    release: (() => void) | undefined;
  const value = Provider({
    token,
    value: "request",
    children() {
      onCleanup(() => cleanup++);
      return compiledTemplate(
        ["<a", ">done</a>"],
        [
          attribute("href", {
            toString() {
              seen.push("coerce:" + useContext(token));
              throw Error("coercion failed");
            },
          }),
        ],
      );
    },
  });
  const rendering = renderToWriter(value, {
    write(chunk: string) {
      seen.push("write:" + useContext(token));
      return new Promise<void>((done) => {
        release = done;
      });
    },
  });
  assert.deepEqual(seen, ["write:request"]);
  assert.equal(getOwner(), null);
  release!();
  await assert.rejects(rendering as Promise<void>, /coercion failed/);
  assert.deepEqual(seen, ["write:request", "coerce:request"]);
  assert.equal(cleanup, 1);
  assert.equal(getOwner(), null);
});

test("protocol oracle abort rejects promptly even if the first or final acknowledgment never resolves", async () => {
  for (const blocked of [0, 2]) {
    const abort = new AbortController();
    let cleanup = 0,
      deferred = 0;
    const chunks: string[] = [];
    const rendering = renderToWriter(
      () => {
        onCleanup(() => cleanup++);
        return compiledTemplate(
          ["head", "footer"],
          [
            () => {
              deferred++;
              return "body";
            },
          ],
        );
      },
      {
        write(chunk: string) {
          chunks.push(chunk);
          if (chunks.length - 1 === blocked) return new Promise<void>(() => {});
        },
      },
      { signal: abort.signal },
    );
    assert.deepEqual(chunks, ["head", "body", "footer"].slice(0, blocked + 1));
    assert.equal(getEventListeners(abort.signal, "abort").length, 1);
    abort.abort(Error("cancel ack"));
    await assert.rejects(rendering as Promise<void>, /cancel ack/);
    assert.equal(cleanup, 1);
    assert.equal(deferred, blocked === 0 ? 0 : 1);
    assert.equal(getOwner(), null);
    assert.equal(getEventListeners(abort.signal, "abort").length, 0);
  }
});

test("protocol oracle failed acknowledgment stops each mixed emission position without replay", async () => {
  const expected = ["<div>a", "<b", ' title="&lt;&amp;"', ">x</b>", "z</div>"];
  for (let blocked = 0; blocked < expected.length; blocked++) {
    const chunks: string[] = [];
    const rendering = renderToWriter(
      compiledTemplate(["<div>", "", "z</div>"], ["a", template(["<b", ">x</b>"], [attribute("title", "<&")])]),
      {
        write(chunk: string) {
          chunks.push(chunk);
          if (chunks.length - 1 === blocked) return Promise.reject(Error("failed ack"));
        },
      },
    );
    await assert.rejects(rendering as Promise<void>, /failed ack/);
    assert.deepEqual(chunks, expected.slice(0, blocked + 1));
  }
});

test("protocol oracle writer reentrancy isolates nested cursors and response output", async () => {
  const outer: string[] = [],
    inner: string[] = [];
  const rendering = renderToWriter(template(["a", "c"], ["b"]), {
    write(chunk: string) {
      outer.push(chunk);
      if (chunk === "a")
        assert.equal(
          renderToWriter(compiledTemplate(["<i>", "</i>"], ["nested"]), {
            write(value: string) {
              inner.push(value);
            },
          }),
          undefined,
        );
      return Promise.resolve();
    },
  });
  await rendering;
  assert.deepEqual(outer, ["a", "b", "c"]);
  assert.deepEqual(inner, ["<i>nested</i>"]);
});

test("protocol oracle getter errors do not prevent later sibling admission when an earlier write fails", async () => {
  const log: string[] = [];
  const first = {
    get then() {
      log.push("first:get");
      throw Error("first getter");
    },
  };
  const later = {
    get then() {
      log.push("later:get");
      return function (this: unknown, resolve: (value: string) => void, reject: (reason: unknown) => void) {
        assert.equal(this, later);
        log.push("later:invoke");
        reject(Error("later rejection"));
      };
    },
  };
  const rendering = renderToWriter(compiledTemplate(["prefix", "", "suffix"], [first as unknown as Opaque, later as Opaque]), {
    write() {
      log.push("write");
      throw Error("writer failed");
    },
  });
  await assert.rejects(rendering as Promise<void>, /writer failed/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(log, ["first:get", "later:get", "write", "later:invoke"]);
});
