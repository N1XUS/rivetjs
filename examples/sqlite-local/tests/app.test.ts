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

test("invalid input redirects with the message", async () => {
  const r = await post("/?/create", form({ title: "", url: "x" }));
  assert.equal(r.status, 303);
  assert.match(decodeURIComponent(r.headers.get("location")!.replaceAll("+", " ")), /error=Title is required/);
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
