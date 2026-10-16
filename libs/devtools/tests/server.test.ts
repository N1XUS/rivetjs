// Dev-server panel middleware: a malformed URL must never reject (connect does not await
// middlewares; an unhandled rejection ends the Vite dev server).
import { test } from "vitest";
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceHash, _uiDir, uiMiddleware, UI_PATH } from "../server.ts";
import { BUILD_PATH, VERSION } from "../protocol.ts";

function call(url: string): Promise<{ status?: number; body: string; next: unknown[] }> {
  const middleware = uiMiddleware("/");
  const out = { status: undefined as number | undefined, body: "", next: [] as unknown[] };
  const res = {
    headersSent: false,
    writeHead(status: number) {
      out.status = status;
      res.headersSent = true;
      return res;
    },
    end(body?: string | Buffer) {
      out.body = body === undefined ? "" : String(body);
    },
    destroy() {},
  };
  return middleware({ url, method: "GET" } as IncomingMessage, res as unknown as ServerResponse, (error?: unknown) => out.next.push(error ?? "next")).then(
    () => out,
  );
}

test("malformed percent-encoding answers 400 instead of rejecting", async () => {
  const reply = await call("/" + UI_PATH + "%E0");
  assert.equal(reply.status, 400);
  assert.match(reply.body, /malformed URL/);
  assert.deepEqual(reply.next, []);
});

test("paths outside the panel pass through", async () => {
  const reply = await call("/app/page");
  assert.deepEqual(reply.next, ["next"]);
  assert.equal(reply.status, undefined);
});

test("the build endpoint serves the protocol version and the live source hash (stale-panel check)", async () => {
  const reply = await call("/" + UI_PATH + BUILD_PATH);
  assert.equal(reply.status, 200);
  const info = JSON.parse(reply.body) as { v: number; hash: string };
  assert.deepEqual(info, { v: VERSION, hash: await sourceHash() });
  assert.match(info.hash, /^[0-9a-f]{16}$/);
});

test("an installed package (dist/ui, no ui/ sources) has no source hash: the panel skips the stale check", async () => {
  const dir = await mkdtemp(join(tmpdir(), "devtools-installed-"));
  try {
    assert.equal(await sourceHash(dir), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a built panel carries the hash of the sources it was built from", async (context) => {
  if (!existsSync(_uiDir + "index.html")) return context.skip();
  const assets = (await readdir(_uiDir, { recursive: true })).filter((file) => file.endsWith(".js"));
  const code = (await Promise.all(assets.map((file) => readFile(_uiDir + file, "utf8")))).join("\n");
  // Fails when dist/ui is older than protocol.ts / ui/: rebuild with `node libs/devtools/build.ts`.
  assert.ok(code.includes((await sourceHash())!), "dist/ui is stale");
});
