// `generateContent(root, { lenient })` (dev server): one page's problems are reported, not thrown, so a
// half-written page (nav entry before its file, unknown link, failing markdown) keeps `serve --dev` up;
// without `lenient` (build, check-content) the same problems throw.
import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, test } from "vitest";
import { generateContent } from "../tools/content/generate.ts";

const repo = resolve(import.meta.dirname, "../../..");
const temp = mkdtempSync(join(tmpdir(), "docs-kit-lenient-"));
const app = join(temp, "apps/site");
const write = (file: string, text: string) => {
  mkdirSync(dirname(join(app, file)), { recursive: true });
  writeFileSync(join(app, file), text);
};
symlinkSync(join(repo, "node_modules"), join(temp, "node_modules"), "dir");
symlinkSync(join(repo, "templates"), join(temp, "templates"), "dir");
write(
  "site.config.ts",
  `export const site = { name: "fixture", tagline: "", origin: "http://127.0.0.1:4391", repo: "", repoRef: "main", packageVersion: "experimental", version: "0" };\n`,
);
write(
  "content/_nav.ts",
  `export const areas = [{ id: "start", title: "Start" }];\n` +
    `export const nav = [{ id: "start", title: "Start", area: "start", groups: [{ title: "Basics", pages: ["start/missing", "start/ok", "start/broken"] }] }];\n`,
);
const page = (title: string, body: string) => `---\ntitle: ${title}\ndescription: ${title} page.\n---\n\n${body}\n`;
write("content/start/ok.md", page("Ok", "See [nowhere](/nowhere/)."));
write("content/start/broken.md", page("Broken", "::example{id=does-not-exist}"));
write("content/start/orphan.md", page("Orphan", "Not in the nav."));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

test("strict (build / check-content): a nav entry without its file throws", async () => {
  await assert.rejects(generateContent(app, { dryRun: true }), /start\/missing has no file/);
});

test("lenient (dev): problems reported once each, the rest of the site generates", async () => {
  const messages: string[] = [];
  await generateContent(app, { lenient: (message) => messages.push(message) });
  assert.ok(
    messages.some((m) => /start\/missing has no file.*skipped/.test(m)),
    messages.join("\n"),
  );
  assert.ok(
    messages.some((m) => /missing from content\/_nav\.ts: start\/orphan/.test(m)),
    messages.join("\n"),
  );
  assert.ok(
    messages.some((m) => /broken\.md.*page shows the error/.test(m)),
    messages.join("\n"),
  );
  assert.ok(
    messages.some((m) => /ok\.md: link to unknown page \/nowhere\//.test(m)),
    messages.join("\n"),
  );
  const routes = join(app, "src/routes/(docs)/start");
  assert.ok(existsSync(join(routes, "ok.tsx")));
  assert.match(readFileSync(join(routes, "broken.tsx"), "utf8"), /failed to render/);
  assert.ok(!existsSync(join(routes, "missing.tsx")));
  const nav = readFileSync(join(app, "src/generated/nav.ts"), "utf8");
  assert.match(nav, /\/start\/ok\//);
  assert.doesNotMatch(nav, /start\/missing/);
});
