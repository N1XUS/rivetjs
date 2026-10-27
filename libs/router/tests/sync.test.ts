// `rivet sync` (T1): `.rivet/` (route types + editor manifest) from the app's Vite config, no Vite server/build.
import { test } from "vitest";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const cli = join(repo, "libs/router/cli/rivet.ts");

function app(files: Record<string, string>): string {
  mkdirSync(join(repo, ".artifacts"), { recursive: true });
  const root = mkdtempSync(join(repo, ".artifacts", "router-sync-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("rivet sync writes route types and the editor manifest from the Vite config", () => {
  const root = app({
    "package.json": JSON.stringify({ name: "sync-app", type: "module" }),
    "vite.config.ts": `import { rivetRouter } from "@rivetjs/router/vite";\nexport default { plugins: [rivetRouter({ routes: "app/pages", resume: { modules: ["src/extra.tsx"] } })] };\n`,
    "app/pages/index.tsx": "export default () => <p>home</p>;\n",
    "app/pages/items/[id].tsx": "export default () => <p>item</p>;\n",
    "src/extra.tsx": "export const Extra = () => <p />;\n",
  });
  try {
    assert.ok(!existsSync(join(root, ".rivet")));
    const run = spawnSync("node", [cli, "sync"], { cwd: root, encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /^rivet sync: \.\/\.rivet \(2 routes, \d+ resume modules\)$/m);
    assert.ok(existsSync(join(root, ".rivet/routes.d.ts")), "route types generated");
    const manifest = JSON.parse(readFileSync(join(root, ".rivet/editor.json"), "utf8"));
    // The app's own options apply (custom routes dir, extra resume module).
    assert.equal(manifest.routesDir, "app/pages");
    assert.deepEqual(
      manifest.routes.map((r: { id: string }) => r.id),
      ["items/[id]", "index"],
    );
    assert.ok(manifest.resumeModules.includes("src/extra.tsx"), manifest.resumeModules);
    // Unchanged contents: re-sync only bumps the mtime (rivet-check's staleness clock).
    const before = statSync(join(root, ".rivet/editor.json")).mtimeMs;
    const text = readFileSync(join(root, ".rivet/editor.json"), "utf8");
    assert.equal(spawnSync("node", [cli, "sync", "--root", root], { encoding: "utf8" }).status, 0);
    assert.equal(readFileSync(join(root, ".rivet/editor.json"), "utf8"), text);
    assert.ok(statSync(join(root, ".rivet/editor.json")).mtimeMs > before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet sync: no Vite config or bad arguments exit 2", () => {
  const root = app({ "package.json": "{}" });
  try {
    const none = spawnSync("node", [cli, "sync"], { cwd: root, encoding: "utf8" });
    assert.equal(none.status, 2);
    assert.match(none.stderr, /no Vite config/);
    assert.equal(spawnSync("node", [cli, "sync", "--nope", "x"], { cwd: root, encoding: "utf8" }).status, 2);
    assert.equal(spawnSync("node", [cli, "sync", "--root"], { cwd: root, encoding: "utf8" }).status, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rivet sync with i18n() in the Vite config (no RIVET_LOCALE): resolves as the server build", () => {
  const root = app({
    "package.json": JSON.stringify({ name: "sync-i18n", type: "module" }),
    "vite.config.ts":
      `import { i18n } from "@rivetjs/i18n/vite";\nimport { rivetRouter } from "@rivetjs/router/vite";\n` +
      `export default { plugins: [i18n({ locales: ["en", "de"], defaultLocale: "en", catalogs: "locales/{locale}.json" }), rivetRouter()] };\n`,
    "locales/en.json": JSON.stringify({ hi: "Hi" }),
    "locales/de.json": JSON.stringify({ hi: "Hallo" }),
    "src/routes/[[lang]]/index.tsx": 'import { t } from "@rivetjs/i18n";\nexport default () => <p>{t("hi")}</p>;\n',
  });
  try {
    const env = { ...process.env };
    delete env.RIVET_LOCALE;
    const run = spawnSync("node", [cli, "sync"], { cwd: root, encoding: "utf8", env });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /^rivet sync: \.\/\.rivet \(2 routes, \d+ resume modules\)$/m);
    assert.ok(existsSync(join(root, ".rivet/editor.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
