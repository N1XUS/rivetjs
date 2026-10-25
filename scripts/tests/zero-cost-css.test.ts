import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { hash } from "../zero-cost/packages-hashes.mjs";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(imports: Record<string, unknown>, source: string, files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "rivet-css-hash-"));
  roots.push(root);
  await writeFile(join(root, "package.json"), JSON.stringify({ name: "css-fixture", type: "module", imports }));
  await writeFile(join(root, "entry.js"), source);
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return root;
}
const css = (text: string) => `css ${createHash("sha256").update(text).digest("hex").slice(0, 12)} ${Buffer.byteLength(text)}`;

test("zero-cost CSS follows the owning package imports map and production/browser conditions", async () => {
  const root = await fixture(
    { "#theme.css": { browser: "./browser.css", production: "./production.css", default: "./default.css" } },
    'import "#theme.css"; export const value = 1;',
    { "production.css": ".production{}", "browser.css": ".browser{}", "default.css": ".default{}" },
  );
  expect((await hash(join(root, "entry.js"), { target: "dom" })).line).toContain(css(".production{}"));
  expect((await hash(join(root, "entry.js"), { target: "dom", browser: true })).line).toContain(css(".browser{}"));
  const other = await fixture({ "#theme.css": "./other.css" }, 'import "#theme.css"; export const value = 1;', { "other.css": ".other{}" });
  expect((await hash(join(other, "entry.js"), { target: "dom" })).line).toContain(css(".other{}"));
});

test("zero-cost CSS resolves imports-map patterns and aliases without a CSS suffix", async () => {
  const root = await fixture({ "#style/*.css": "./css/*.css", "#base": "./base.css" }, 'import "#style/one.css"; import "#base"; export const value = 1;', {
    "css/one.css": ".one{}",
    "base.css": ".base{}",
  });
  expect((await hash(join(root, "entry.js"), { target: "dom" })).line).toContain(css(".base{}\n.one{}"));
});

test("zero-cost CSS retains relative/absolute imports, deduplicates resolved aliases and observes byte changes", async () => {
  const root = await fixture({ "#style.css": "./style.css" }, "export const value = 1;", { "style.css": ".first{}", "z.css": ".last{}" });
  await writeFile(join(root, "entry.js"), `import "./style.css"; import "#style.css"; import ${JSON.stringify(join(root, "z.css"))}; export const value = 1;`);
  expect((await hash(join(root, "entry.js"), { target: "dom" })).line).toContain(css(".first{}\n.last{}"));
  await writeFile(join(root, "style.css"), ".changed{}");
  expect((await hash(join(root, "entry.js"), { target: "dom" })).line).toContain(css(".changed{}\n.last{}"));
});

test.each([
  [{ "#missing.css": "./missing.css" }, 'import "#missing.css";'],
  [{}, 'import "./missing.css";'],
  [{}, 'import "#absent.css";'],
])("zero-cost CSS rejects missing stylesheet targets", async (imports, source) => {
  const root = await fixture(imports as Record<string, unknown>, source as string, {});
  await expect(hash(join(root, "entry.js"), { target: "dom" })).rejects.toThrow();
});
