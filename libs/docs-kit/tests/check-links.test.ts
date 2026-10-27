import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLinks } from "../tools/check-links.ts";

test("checkLinks resolves query URLs by pathname and still checks anchors and missing pages", async () => {
  const dist = await mkdtemp(join(tmpdir(), "rivet-links-"));
  try {
    await mkdir(join(dist, "client/search"), { recursive: true });
    await writeFile(
      join(dist, "client/index.html"),
      `
      <a href="/search/?q=router&amp;sort=asc#results">root</a>
      <a href="search/?q=router#results">relative</a>
      <a href="?q=router#home">same</a><h1 id="home">Home</h1>
      <a href="/search/?q=router#missing">bad anchor</a>
      <a href="/missing/?q=router">bad page</a>
      <img src="/image.svg?v=1">
    `,
    );
    await writeFile(join(dist, "client/search/index.html"), '<h1 id="results">Search</h1>');
    await writeFile(join(dist, "client/image.svg"), "<svg/>");
    assert.deepEqual(await checkLinks(dist), ["/index.html: #missing not found in /search/?q=router", '/index.html: href="/missing/?q=router" does not exist']);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});
