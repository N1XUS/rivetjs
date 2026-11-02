// Builds the example and boots the production server on a temp SQLite file: pages, JS-off form posts, JSON endpoints.
import { afterAll, beforeAll, test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = 4470;
const base = `http://127.0.0.1:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), "rivet-sqlite-local-"));
let serving: { close(): unknown } | undefined;
let jsBytes = 0;

beforeAll(async () => {
  const vite = ["node_modules/vite/bin/vite.js", "../../node_modules/vite/bin/vite.js"].map((p) => join(root, p));
  const bin = vite.find((p) => {
    try {
      execFileSync("test", ["-f", p]);
      return true;
    } catch {
      return false;
    }
  })!;
  for (const args of [["build"], ["build", "--ssr"]])
    execFileSync(process.execPath, [bin, ...args], { cwd: root, stdio: "pipe", env: { ...process.env, NODE_ENV: "production" } });
  process.env.DATABASE_PATH = join(dir, "t.db");
  process.chdir(root);
  const { start } = await import("@rivetjs/router/node");
  serving = await start({ dist: join(root, "dist"), port: PORT, host: "127.0.0.1" });
  const html = await (await fetch(base + "/")).text();
  for (const m of html.matchAll(/src="([^"]+\.js)"/g)) jsBytes += (await (await fetch(base + m[1])).arrayBuffer()).byteLength;
}, 180_000);
afterAll(async () => {
  await (serving as { close(): Promise<unknown> } | undefined)?.close();
  rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, body: BodyInit, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: "POST", body, redirect: "manual", headers: { origin: base, ...headers } });
const form = (o: Record<string, string>) => new URLSearchParams(o);

test("health, seeded list, pagination link", async () => {
  assert.equal((await fetch(base + "/healthz")).status, 200);
  const html = await (await fetch(base + "/")).text();
  assert.match(html.replace(/<!--.*?-->/g, ""), /500 saved/);
  assert.match(html, /Reading list item 500/);
  assert.match(html, /rel="next"/);
});

test("JS-off create / search / tag / edit / delete via redirecting forms", async () => {
  const r = await post("/?/create", form({ title: "Zebra notes", url: "https://zebra.example/a", tags: "Zoo animals" }));
  assert.equal(r.status, 303);
  const found = await (await fetch(base + "/?q=zebra")).text();
  assert.match(found, /Zebra notes/);
  assert.match(await (await fetch(base + "/?tag=zoo")).text(), /Zebra notes/);
  const id = /name="id" value="(\d+)"/.exec(found)![1]!;
  assert.match(await (await fetch(base + `/?q=zebra&edit=${id}`)).text(), /action="\?\/update"/);
  assert.equal((await post("/?/update", form({ id, title: "Zebra edited", url: "https://zebra.example/a", tags: "zoo" }))).status, 303);
  assert.match(await (await fetch(base + "/?q=zebra")).text(), /Zebra edited/);
  assert.equal((await post("/?/remove", form({ id }))).status, 303);
  assert.match(await (await fetch(base + "/?q=zebra")).text(), /No bookmarks match/);
});

test("invalid input redirects with an error code; the page shows its message, never text from the URL", async () => {
  const r = await post("/?/create", form({ title: "", url: "x" }));
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/?error=title-required");
  assert.match(await (await fetch(base + "/?error=title-required")).text(), /role="alert"[^>]*>Title is required/);
  const spoofed = await (await fetch(base + "/?error=" + encodeURIComponent("Your session expired, call 555-0100"))).text();
  assert.doesNotMatch(spoofed, /555-0100/);
  assert.doesNotMatch(spoofed, /role="alert"/);
});

test("add / edit / delete keep the visitor's search and tag filter", async () => {
  const page = await (await fetch(base + "/?q=reading&tag=rust")).text();
  assert.match(page, /name="q" value="reading"/);
  assert.match(page, /name="tag" value="rust"/);
  const created = await post("/?/create", form({ title: "Filtered add", url: "https://f.example", tags: "rust", q: "reading", tag: "rust" }));
  assert.equal(created.headers.get("location"), "/?q=reading&tag=rust");
  const invalid = await post("/?/create", form({ title: "", url: "x", q: "reading", tag: "rust" }));
  assert.equal(invalid.headers.get("location"), "/?q=reading&tag=rust&error=title-required");
  const id = /name="id" value="(\d+)"/.exec(page)![1]!;
  const removed = await post("/?/remove", form({ id, q: "reading", tag: "rust" }));
  assert.equal(removed.headers.get("location"), "/?q=reading&tag=rust");
});

test("import then export", async () => {
  const bad = await post("/api/import", JSON.stringify([{ title: "", url: "x" }]), { "content-type": "application/json" });
  assert.equal(bad.status, 400);
  const ok = await post("/api/import", JSON.stringify([{ title: "Imported", url: "https://imp.example", tags: ["imp"] }]), {
    "content-type": "application/json",
  });
  assert.deepEqual(await ok.json(), { added: 1 });
  const exported = (await (await fetch(base + "/api/export.json")).json()) as { title: string }[];
  assert.ok(exported.some((b) => b.title === "Imported"));
});

test("import bodies over the router's 1 MiB maxBody are refused before the handler (413)", async () => {
  const huge = JSON.stringify([{ title: "x".repeat(2 * 1024 * 1024), url: "https://big.example" }]);
  const r = await post("/api/import", huge, { "content-type": "application/json" });
  assert.equal(r.status, 413);
  await r.body?.cancel();
});

test("cross-site form posts are rejected", async () => {
  const r = await fetch(base + "/?/create", {
    method: "POST",
    body: form({ title: "x", url: "https://x.dev" }),
    redirect: "manual",
    headers: { origin: "http://evil.example" },
  });
  assert.equal(r.status, 403);
});

test("client JS stays within budget", () => {
  const budget = 40 * 1024;
  assert.ok(jsBytes <= budget, `${jsBytes} > ${budget}`);
});
