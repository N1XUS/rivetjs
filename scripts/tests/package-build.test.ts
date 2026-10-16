// scripts/package/build.ts + smoke.ts: publishable `dist/libs/<pkg>` packages (P1/P2 of the round-2 review).
import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, test } from "vitest";
import { buildPackage, distManifest, githubWeb, mapConditions, mapTarget, rewriteSpecifiers, targetsOf, urlTargets } from "../package/build.ts";
import { REQUIRED_PEERS, smoke } from "../package/smoke.ts";
import { ROOT } from "../release/version.ts";

const dir = mkdtempSync(join(tmpdir(), "package-build-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const walk = (at: string, base = at): string[] =>
  readdirSync(at, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(at, entry.name), base) : [join(at, entry.name).slice(base.length + 1)],
  );

test("manifest paths: types → .d.ts, .ts → .js, .tsx → .jsx (JSX kept for the consumer's Rivet compiler)", () => {
  assert.equal(mapTarget("types", "./index.ts"), "./index.d.ts");
  assert.equal(mapTarget("types", "./icon.tsx"), "./icon.d.ts");
  assert.equal(mapTarget("default", "./icon.tsx"), "./icon.jsx");
  assert.equal(mapTarget("development", "./dev.ts"), "./dev.js");
  assert.equal(mapTarget("types", "./client.d.ts"), "./client.d.ts");
  assert.equal(mapTarget("default", "./transitions.css"), "./transitions.css");
  assert.deepEqual(mapConditions({ types: "./a/*.ts", browser: "./a/*-dom.ts", default: "./a/*.ts" }), {
    types: "./a/*.d.ts",
    browser: "./a/*-dom.js",
    default: "./a/*.js",
  });
  assert.deepEqual(targetsOf({ types: "./x.ts", node: { development: "./d.ts", default: "./x.ts" } }), ["./x.ts", "./d.ts", "./x.ts"]);
});

test("specifier rewrite: .d.ts imports and JS new URL(…, import.meta.url) module paths", () => {
  assert.equal(
    rewriteSpecifiers(
      `import type { A } from "./a.ts";\nexport * from '../b.tsx';\ntype C = import("./c.ts").C;\nimport "./side.ts";\nexport { x } from "pkg/y.ts";`,
      true,
    ),
    `import type { A } from "./a.js";\nexport * from '../b.jsx';\ntype C = import("./c.js").C;\nimport "./side.js";\nexport { x } from "pkg/y.ts";`,
  );
  assert.equal(rewriteSpecifiers(`import { t } from "./types.d.ts";`, true), `import { t } from "./types.d.ts";`);
  assert.equal(
    rewriteSpecifiers(
      `const a = new URL("../shared/base.ts", import.meta.url);\nconst w = new URL("./x.wasm", import.meta.url);\nconst s = "./app.tsx";`,
      false,
    ),
    `const a = new URL("../shared/base.js", import.meta.url);\nconst w = new URL("./x.wasm", import.meta.url);\nconst s = "./app.tsx";`,
  );
  assert.deepEqual(urlTargets(`new URL("./rivet_compiler.wasm", import.meta.url); new URL('./dist/ui/', import.meta.url); new URL("https://x")`), [
    "./rivet_compiler.wasm",
    "./dist/ui/",
  ]);
  // Comments that show the form are not targets.
  assert.deepEqual(
    urlTargets(
      `// paths like new URL("./x.ts", import.meta.url) are rewritten\n/**\n * new URL("./y.ts", import.meta.url)\n */\nconst a = new URL("./a.ts", import.meta.url);`,
    ),
    ["./a.ts"],
  );
});

test("dist manifest: workspace-only fields dropped, bin mapped, publishConfig.access kept, repository per package", () => {
  const manifest = distManifest(
    {
      name: "@rivetjs/x",
      version: "0.0.0-experimental",
      private: true,
      bin: { x: "./cli/x.ts" },
      exports: { ".": { types: "./index.ts", default: "./index.ts" }, "./package.json": "./package.json" },
      scripts: { parity: "node oracle/check.ts" },
      devDependencies: { esbuild: "0.28.2" },
      publishConfig: { access: "public", directory: "../../dist/libs/x", bundle: "./bundle.ts" },
    },
    ["index.js", "index.d.ts", "cli/x.js", "LICENSE", "package.json"],
    { type: "git", url: "git+https://example.com/rivet.git" },
    "libs/x",
  );
  assert.equal(manifest.private, undefined);
  assert.equal(manifest.scripts, undefined);
  assert.equal(manifest.devDependencies, undefined);
  assert.deepEqual(manifest.bin, { x: "./cli/x.js" });
  assert.deepEqual(manifest.exports, { ".": { types: "./index.d.ts", default: "./index.js" }, "./package.json": "./package.json" });
  assert.deepEqual(manifest.publishConfig, { access: "public" });
  assert.deepEqual(manifest["repository"], { type: "git", url: "git+https://example.com/rivet.git", directory: "libs/x" });
  assert.deepEqual(manifest.files, ["LICENSE", "cli", "index.d.ts", "index.js"]);
  // Not a GitHub repository: no derived homepage / bugs.
  assert.equal(manifest["homepage"], undefined);
});

test("dist manifest: language-core declares @rivetjs/compiler as a peer (one compiler / wasm per app)", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "libs/language-core/package.json"), "utf8"));
  const manifest = distManifest(pkg, ["index.js"]);
  assert.ok((manifest["peerDependencies"] as Record<string, string>)["@rivetjs/compiler"]);
  assert.equal(manifest.devDependencies, undefined);
  assert.deepEqual(REQUIRED_PEERS["@rivetjs/language-core"], ["@rivetjs/compiler"]);
});

test("dist manifest: homepage + bugs derived from a GitHub repository", () => {
  assert.equal(githubWeb({ type: "git", url: "git+https://github.com/rivetjs/rivet.git" }), "https://github.com/rivetjs/rivet");
  assert.equal(githubWeb("github.com:o/r"), "https://github.com/o/r");
  assert.equal(githubWeb("https://example.com/r.git"), undefined);
  const manifest = distManifest({ name: "@rivetjs/x", version: "1.0.0" }, ["index.js"], "git+https://github.com/rivetjs/rivet.git", "libs/x");
  assert.equal(manifest["homepage"], "https://github.com/rivetjs/rivet/tree/main/libs/x#readme");
  assert.deepEqual(manifest["bugs"], { url: "https://github.com/rivetjs/rivet/issues" });
});

test("libs/kit builds: .js / .jsx / .d.ts only, no tests or CLAUDE.md, LICENSE, every manifest path present, no .ts specifiers left", () => {
  const out = join(dir, "kit");
  const result = buildPackage("libs/kit", out, { typecheck: false });
  assert.deepEqual(result.warnings, []);
  const files = walk(out);
  assert.ok(files.includes("LICENSE") && files.includes("icon.jsx") && files.includes("icon.d.ts") && files.includes("index.js"), files.join(" "));
  assert.deepEqual(
    files.filter((file) => !/\.(?:js|jsx|d\.ts)$/.test(file) && file !== "LICENSE" && file !== "README.md" && file !== "package.json"),
    [],
  );
  assert.ok(!files.some((file) => file.startsWith("tests/") || file.endsWith("CLAUDE.md")));
  const manifest = JSON.parse(readFileSync(join(out, "package.json"), "utf8"));
  assert.equal(manifest.private, undefined);
  assert.deepEqual(manifest.rivet, { source: true });
  // Generated README (libs/kit has none): description + install line.
  const readme = readFileSync(join(out, "README.md"), "utf8");
  assert.match(readme, /^# @rivetjs\/kit\n\nRivet kit: /);
  assert.match(readme, /npm install @rivetjs\/kit/);
  for (const value of Object.values(manifest.exports) as never[]) for (const target of targetsOf(value)) assert.ok(existsSync(join(out, target)), target);
  for (const file of files.filter((file) => /\.(?:jsx?|d\.ts)$/.test(file))) {
    const text = readFileSync(join(out, file), "utf8");
    assert.doesNotMatch(text, /from\s*["']\.\.?\/[^"']*\.tsx?["']/, file);
  }
});

test("libs/create-rivet: publishConfig.bundle step adds the repo templates (.gitignore as _gitignore), bin keeps its shebang", () => {
  const out = join(dir, "create-rivet");
  const result = buildPackage("libs/create-rivet", out, { typecheck: false });
  assert.deepEqual(result.warnings, []);
  const files = walk(out);
  for (const template of ["starter-minimal", "starter-static", "starter-server", "starter-ui"]) {
    assert.ok(files.includes(`templates/${template}/package.json`) && files.includes(`templates/${template}/_gitignore`), template);
  }
  assert.ok(!files.some((file) => /(^|\/)(node_modules|dist|\.rivet)\/|\.gitignore$|\.stackblitzrc$|bundle\.(js|d\.ts)$/.test(file)), files.join(" "));
  const manifest = JSON.parse(readFileSync(join(out, "package.json"), "utf8"));
  assert.deepEqual(manifest.bin, { "create-rivet": "./cli.js" });
  assert.deepEqual(manifest.publishConfig, { access: "public" });
  assert.ok(manifest.files.includes("templates"));
  assert.match(readFileSync(join(out, "cli.js"), "utf8"), /^#!\/usr\/bin\/env node\n/);
});

test("libs/compiler ships its wasm next to the loader and no Rust sources / oracle / tests", () => {
  const out = join(dir, "compiler");
  const result = buildPackage("libs/compiler", out, { typecheck: false });
  assert.deepEqual(result.warnings, []);
  const files = walk(out);
  assert.ok(files.includes("rivet_compiler.wasm") && files.includes("wasm.js") && files.includes("codes.json") && files.includes("images/client.d.ts"));
  assert.ok(!files.some((file) => /^(?:rust|oracle|tests)\//.test(file) || file.endsWith(".rs")), files.join(" "));
});

test("tarball smoke: packed reactivity + runtime + compiler install offline, import under Node, type-check under strict consumer flags", () => {
  const failures = smoke(["reactivity", "runtime", "compiler"], { dist: join(dir, "smoke") });
  assert.deepEqual(failures, []);
});
