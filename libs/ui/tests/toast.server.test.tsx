// Server-target suite: `Toast.Provider` SSR (upstream toast.ssr.test.tsx: renders without errors) — the cdk ToastRegion renders
// only its empty anchor on the server (no region, no toast, no client code before the first toast); queued toasts never reach
// the server HTML (the queue lives in the browser).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Toast, ToastQueue } from "../index.ts";

test("toast SSR: provider renders only the region anchor", async () => {
  const html = await renderToString(() => (
    <main>
      <Toast.Provider />
      <p>Page</p>
    </main>
  ));
  assert.match(html, /data-rv-toast-anchor/);
  assert.match(html, />Page</);
  assert.doesNotMatch(html, /role="region"/);
  assert.doesNotMatch(html, /toast-region/);
});

test("toast SSR: custom queue + placement + children render no toast markup", async () => {
  const queue = new ToastQueue({ name: "ssr-custom" });
  queue.add({ title: "Server toast" });
  const html = await renderToString(() => (
    <Toast.Provider queue={queue} placement="top end" width={320}>
      {({ toast }) => <Toast toast={toast}>{String(toast.content.title)}</Toast>}
    </Toast.Provider>
  ));
  assert.match(html, /data-rv-toast-anchor/);
  assert.doesNotMatch(html, /Server toast/);
  assert.doesNotMatch(html, /alertdialog/);
  queue.destroy();
});
