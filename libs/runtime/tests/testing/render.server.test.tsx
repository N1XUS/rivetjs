// Server-target suite (`*.server.test.tsx`): this file and the .tsx modules it imports compile for the server.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Counter, Greeting, Width } from "./components.tsx";

test("renderToString resolves synchronous output", async () => {
  const html = renderToString(() => <Counter start={3} />);
  assert.ok(html instanceof Promise);
  assert.equal(await html, '<div class="counter"><button>+2</button><output>3</output></div>');
});

test("renderToString awaits Async children; clientEffect does not run on the server", async () => {
  assert.equal(
    await renderToString(() => <Greeting name={Promise.resolve("server")} />),
    "<section><b>hello server</b></section>",
  );
  assert.equal(await renderToString(() => <Width />), "<p>pending</p>");
});

test("renderToString rejects on render failure", async () => {
  const Broken = (): never => {
    throw new Error("boom");
  };
  await assert.rejects(
    renderToString(() => <Broken />),
    /boom/,
  );
});
