// The static starters' `serve.js` preview (starter-static, starter-ui): folders → index.html, percent-decoded paths,
// 400 on a malformed escape, 404 page, and an empty `PORT` falls back to the default instead of a random port.
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const templates = fileURLToPath(new URL("../../../templates/", import.meta.url));

async function withPreview(template: string, port: number, run: (base: string) => Promise<void>) {
  const cwd = mkdtempSync(join(tmpdir(), "rivet-serve-"));
  const client = join(cwd, "dist/client");
  mkdirSync(join(client, "über"), { recursive: true });
  mkdirSync(join(client, "about"), { recursive: true });
  writeFileSync(join(client, "index.html"), "<p>home</p>");
  writeFileSync(join(client, "about/index.html"), "<p>about</p>");
  writeFileSync(join(client, "über/index.html"), "<p>umlaut</p>");
  writeFileSync(join(client, "404.html"), "<p>missing</p>");
  const child = spawn(process.execPath, [join(templates, template, "serve.js")], { cwd, env: { ...process.env, PORT: String(port) }, stdio: "pipe" });
  try {
    await new Promise<void>((done, fail) => {
      let out = "";
      child.stdout.on("data", (chunk) => (out += chunk) && out.includes("Preview:") && done());
      child.stderr.on("data", (chunk) => (out += chunk));
      child.once("exit", (code) => fail(new Error(`serve.js exited ${code}: ${out}`)));
    });
    await run(`http://127.0.0.1:${port}`);
  } finally {
    child.kill();
    rmSync(cwd, { recursive: true, force: true });
  }
}

for (const [template, port] of [
  ["starter-static", 4531],
  ["starter-ui", 4532],
] as const)
  test(`${template} serve.js: folders, percent-decoded paths, 400 on a malformed escape, 404 page`, async () => {
    await withPreview(template, port, async (base) => {
      const home = await fetch(base + "/");
      assert.equal(home.status, 200);
      assert.equal(await home.text(), "<p>home</p>");
      const redirect = await fetch(base + "/about", { redirect: "manual" });
      assert.equal(redirect.status, 308);
      assert.equal(new URL(redirect.headers.get("location")!, base).pathname, "/about/");
      const umlaut = await fetch(base + "/%C3%BCber/");
      assert.equal(umlaut.status, 200);
      assert.equal(await umlaut.text(), "<p>umlaut</p>");
      assert.equal((await fetch(base + "/%E0/")).status, 400);
      const missing = await fetch(base + "/nope/");
      assert.equal(missing.status, 404);
      assert.equal(await missing.text(), "<p>missing</p>");
    });
  });
