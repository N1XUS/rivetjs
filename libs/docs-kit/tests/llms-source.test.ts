import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLlmsSource } from "../tools/llms/source.ts";

test("LLMS reads preserve nav order across batches and the first parse/read error", async () => {
  const root = await mkdtemp(join(tmpdir(), "rivet-llms-order-"));
  try {
    await mkdir(join(root, "content"));
    await mkdir(join(root, "examples"));
    await writeFile(join(root, "site.config.ts"), 'export const site = { name: "Fixture", origin: "https://example.test", tagline: "Test" };');
    const pages = Array.from({ length: 35 }, (_, i) => `page${i}`);
    await writeFile(
      join(root, "content/_nav.ts"),
      `export const nav = [{ id: "s", title: "S", area: "a", groups: [{title: "G", pages: ${JSON.stringify(pages)}}] }];`,
    );
    for (const page of pages) await writeFile(join(root, `content/${page}.md`), `---\ntitle: ${page}\ndescription: Description\n---\nBody\n`);
    assert.deepEqual(
      (await loadLlmsSource(root)).pages.map((p) => p.path),
      pages,
    );
    await writeFile(join(root, "content/page0.md"), "invalid frontmatter");
    await rm(join(root, "content/page1.md"));
    await assert.rejects(loadLlmsSource(root), /content\/page0.md: missing frontmatter/);
    await rm(join(root, "content/page0.md"));
    await assert.rejects(loadLlmsSource(root), /page0.md/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
