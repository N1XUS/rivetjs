// `serve` build swaps (tools/serve.ts `serveSwappable` + `replaceDir`): while builds are swapped in
// under load, every response comes whole from one build — never a 404, a 503 or a mix of two builds.
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { replaceDir, serveSwappable } from "../tools/serve.ts";

function writeBuild(dir: string, version: number): void {
  mkdirSync(join(dir, "guide/assets"), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  // The page names its build's asset: a mixed response pairs a page with another build's asset.
  writeFileSync(join(dir, "index.html"), `<!doctype html><p>home v${version}</p><script src="/assets/app-${version}.js"></script>`);
  writeFileSync(join(dir, "guide/index.html"), `<p>guide v${version}</p>`);
  writeFileSync(join(dir, `assets/app-${version}.js`), `console.log(${version})`);
}

test("replaceDir: the staged dir takes the target's place, the old one goes to trash", () => {
  const dist = mkdtempSync(join(tmpdir(), "docs-kit-swap-"));
  writeBuild(join(dist, "client"), 1);
  writeBuild(join(dist, ".next/client"), 2);
  return replaceDir(join(dist, "client"), join(dist, ".next/client"), join(dist, ".trash/client")).then(() => {
    assert.match(readFileSync(join(dist, "client/index.html"), "utf8"), /home v2/);
    assert.match(readFileSync(join(dist, ".trash/client/index.html"), "utf8"), /home v1/);
    assert.equal(existsSync(join(dist, ".next/client")), false);
  });
});

test("serveSwappable: 30 swaps under concurrent requests, each answer from exactly one build", { timeout: 60_000 }, async () => {
  const dist = mkdtempSync(join(tmpdir(), "docs-kit-swap-"));
  const client = join(dist, "client");
  writeBuild(client, 0);
  const serving = await serveSwappable(client, 0);
  let stop = false;
  const seen = new Set<number>();
  const problems: string[] = [];
  const hammer = async () => {
    while (!stop) {
      const page = await fetch(serving.url + "/");
      const text = await page.text();
      const version = Number(/home v(\d+)/.exec(text)?.[1]);
      if (page.status !== 200 || Number.isNaN(version)) problems.push(`GET / → ${page.status} ${text.slice(0, 60)}`);
      else seen.add(version);
      const guide = await fetch(serving.url + "/guide/");
      if (guide.status !== 200) problems.push(`GET /guide/ → ${guide.status}`);
    }
  };
  const clients = Array.from({ length: 8 }, hammer);
  try {
    for (let version = 1; version <= 30; version++) {
      writeBuild(join(dist, ".next/client"), version);
      await serving.swap(() => replaceDir(client, join(dist, ".next/client"), join(dist, `.trash/${version}`)));
      // After a swap returns, every request sees the new build (page and its asset together).
      const page = await (await fetch(serving.url + "/")).text();
      assert.match(page, new RegExp(`home v${version}<`));
      assert.equal((await fetch(serving.url + `/assets/app-${version}.js`)).status, 200);
      assert.equal((await fetch(serving.url + `/assets/app-${version - 1}.js`)).status, 404);
      await new Promise((done) => setTimeout(done, 5));
    }
  } finally {
    stop = true;
    await Promise.all(clients);
    await serving.close();
  }
  assert.deepEqual(problems, []);
  assert.ok(seen.size > 5, `requests saw ${seen.size} builds`);
});

test("serveSwappable: before the first build the docs origin answers 503 and reloads", async () => {
  const dist = mkdtempSync(join(tmpdir(), "docs-kit-swap-"));
  const serving = await serveSwappable(join(dist, "client"), 0);
  try {
    const response = await fetch(serving.url + "/");
    assert.equal(response.status, 503);
    assert.match(await response.text(), /http-equiv="refresh"/);
    writeBuild(join(dist, ".next/client"), 1);
    await serving.swap(() => replaceDir(join(dist, "client"), join(dist, ".next/client"), join(dist, ".trash")));
    assert.equal((await fetch(serving.url + "/guide/")).status, 200);
  } finally {
    await serving.close();
  }
});
