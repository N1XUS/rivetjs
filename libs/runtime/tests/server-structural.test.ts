import { test } from "vitest";
import assert from "node:assert/strict";
import * as server from "../server.ts";
import { createContext, useContext, onCleanup, getOwner } from "@rivetjs/reactivity";

/** Renders here are asynchronous, so the `string | Promise` / `void | Promise` results are promises. */
const rejects = (value: unknown, error: Parameters<typeof assert.rejects>[1]): Promise<void> =>
  assert.rejects(value as Promise<unknown>, error);

type ServerValue = Parameters<typeof server.renderToString>[0];

test("server providers retain logical context for deferred reads through backpressure", async () => {
  const theme = createContext("default");
  let cleaned = 0;
  const value = server.Provider({
    token: theme,
    value: "light",
    children() {
      onCleanup(() => cleaned++);
      return server.template(["<b>", "</b>"], [() => useContext(theme)]);
    },
  });
  const chunks: string[] = [];
  await server.renderToWriter(value, {
    write(chunk: string) {
      chunks.push(chunk);
      return Promise.resolve();
    },
  });
  assert.equal(chunks.join(""), "<b>light</b>");
  assert.equal(cleaned, 1);
  assert.equal(useContext(theme), "default");
});

test("server providers dispose admitted scopes even when an earlier write fails", async () => {
  const theme = createContext("default");
  let cleaned = 0;
  const value = server.Provider({
    token: theme,
    value: "light",
    children() {
      onCleanup(() => cleaned++);
      return "later";
    },
  });
  await rejects(
    server.renderToWriter(["first", value], {
      write() {
        throw new Error("sink failed");
      },
    }),
    /sink failed/,
  );
  assert.equal(cleaned, 1);
});

test("server keyed lists render accessors in order and reject duplicate keys before row setup", () => {
  let setup = 0;
  const props = {
    each: () => [{ id: "a" }, { id: "b" }],
    by: (item: { id: string }) => item.id,
    children: (item: () => { id: string }, index: () => number) => {
      setup++;
      return server.template(["<i>", "</i>"], [item().id + index()]);
    },
  };
  assert.equal(server.renderToString(server.For(props)), "<i>a0</i><i>b1</i>");
  assert.equal(setup, 2);
  setup = 0;
  assert.throws(() => server.For({ ...props, each: () => [{ id: "a" }, { id: "a" }] }), /Duplicate/);
  assert.equal(setup, 0);
});

test("server namespace attributes preserve false SVG/MathML values", () => {
  assert.equal(server.renderToString(server.attribute("disabled", false, "svg")), ' disabled="false"');
  assert.equal(server.renderToString(server.attribute("disabled", false)), "");
  assert.equal(server.renderToString(server.attribute("disabled", false, "mathml")), ' disabled="false"');
});

test("nested providers shadow deferred reads and independent responses restore the global owner", async () => {
  const theme = createContext("default");
  const make = (value: string) =>
    server.Provider({
      token: theme,
      value,
      children: () => [
        () => useContext(theme),
        server.Provider({ token: theme, value: "inner", children: () => () => useContext(theme) }),
        () => useContext(theme),
      ],
    });
  const first = server.renderToWriter(make("outer"), { write: () => Promise.resolve() });
  assert.equal(getOwner(), null);
  assert.equal(server.renderToString(make("other")), "otherinnerother");
  await first;
  assert.equal(getOwner(), null);
});

test("abort disposes prepared provider scopes while a writer is pending", async () => {
  let cleaned = 0;
  const abort = new AbortController();
  const value = server.Provider({
    token: createContext(null),
    value: null,
    children() {
      onCleanup(() => cleaned++);
      return server.template(["before", "after"], [() => "child"]);
    },
  });
  const rendered = server.renderToWriter(value, { write: () => new Promise(() => {}) }, { signal: abort.signal });
  assert.equal(getOwner(), null);
  abort.abort(new Error("cancelled"));
  await rejects(rendered, /cancelled/);
  assert.equal(cleaned, 1);
});

test("setup failures dispose partially prepared providers and rows without leaking owner context", () => {
  const theme = createContext("default");
  let cleaned = 0;
  assert.throws(
    () =>
      server.Provider({
        token: theme,
        value: "bad",
        children() {
          onCleanup(() => cleaned++);
          throw new Error("provider setup");
        },
      }),
    /provider setup/,
  );
  assert.equal(cleaned, 1);
  assert.equal(useContext(theme), "default");
  assert.throws(
    () =>
      server.For({
        each: () => ["a", "b"],
        by: (item: string) => item,
        children(item: () => string) {
          onCleanup(() => cleaned++);
          if (item() === "b") throw new Error("row setup");
          return item;
        },
      }),
    /row setup/,
  );
  assert.equal(cleaned, 3);
  assert.equal(getOwner(), null);
});

test("all admitted roots clean up despite cleanup failure and original writer failure wins", async () => {
  const cleaned: string[] = [];
  const make = (name: string, fail: boolean) =>
    server.Provider({
      token: createContext(null),
      value: null,
      children() {
        onCleanup(() => {
          cleaned.push(name);
          if (fail) throw new Error("cleanup failed");
        });
        return name;
      },
    });
  await rejects(
    server.renderToWriter([make("a", true), make("b", false)], {
      write() {
        throw new Error("write failed");
      },
    }),
    /write failed/,
  );
  assert.deepEqual(cleaned, ["a", "b"]);
  cleaned.length = 0;
  await rejects(server.renderToString([make("a", true), make("b", false)]), /cleanup failed/);
  assert.deepEqual(cleaned, ["a", "b"]);
});

test("scopes resolved after cancellation are still disposed through promise admission", async () => {
  let resolve: ((value: ServerValue) => void) | undefined;
  let cleaned = 0;
  const later = new Promise<ServerValue>((done) => {
    resolve = done;
  });
  const abort = new AbortController();
  const rendered = server.renderToWriter(
    ["first", later],
    { write: () => new Promise(() => {}) },
    { signal: abort.signal },
  );
  abort.abort(new Error("cancelled"));
  await rejects(rendered, /cancelled/);
  resolve!(
    server.Provider({
      token: createContext(null),
      value: null,
      children() {
        onCleanup(() => cleaned++);
        return "later";
      },
    }),
  );
  // ServerValue includes PromiseLike<ServerValue>, so await its settlement untyped.
  await (later as Promise<unknown>);
  assert.equal(cleaned, 1);
});

test("server scoped values are consumed once per response, including scalar outputs", async () => {
  const value = server.Provider({ token: createContext(null), value: null, children: () => "once" });
  assert.equal(server.renderToString(value), "once");
  await rejects(server.renderToString(value), /disposed owner/);
});

test("attribute coercion retains provider context after writer backpressure", async () => {
  const token = createContext("DEFAULT");
  let coerced = 0;
  const make = () =>
    server.Provider({
      token,
      value: "INNER",
      children: () => [
        "head",
        server.attribute("title", {
          toString() {
            coerced++;
            return useContext(token);
          },
        }),
      ],
    });
  assert.equal(server.renderToString(make()), 'head title="INNER"');
  const chunks: string[] = [];
  const rendered = server.renderToWriter(make(), {
    write(chunk: string) {
      chunks.push(chunk);
      return Promise.resolve();
    },
  });
  assert.equal(getOwner(), null);
  await rendered;
  assert.equal(chunks.join(""), 'head title="INNER"');
  assert.equal(coerced, 2);
  assert.equal(getOwner(), null);
});

test("resolved attribute values coerce under the captured provider owner", async () => {
  const token = createContext("DEFAULT");
  let coerced = 0;
  const value = server.Provider({
    token,
    value: "INNER",
    children: () => [
      "head",
      server.attribute(
        "title",
        Promise.resolve({
          toString() {
            coerced++;
            return useContext(token);
          },
        }),
      ),
    ],
  });
  const chunks: string[] = [];
  const rendered = server.renderToWriter(value, {
    write(chunk: string) {
      chunks.push(chunk);
      return Promise.resolve();
    },
  });
  assert.equal(getOwner(), null);
  await rendered;
  assert.equal(chunks.join(""), 'head title="INNER"');
  assert.equal(coerced, 1);
  assert.equal(getOwner(), null);
});
