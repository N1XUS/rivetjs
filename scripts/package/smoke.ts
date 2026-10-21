// Tarball smoke test: builds the publishable packages (`build.ts`), packs them with `npm pack`, installs the
// tarballs into a temp consumer project (`npm install --offline`: local tarballs + the npm cache, no registry
// writes), then
//   1. imports every runtime `exports` subpath under plain Node (default and `development` conditions;
//      `.jsx` entries through `@rivetjs/runtime/testing/register`, DOM and server targets),
//   2. type-checks a consumer that imports every typed subpath and renders TSX, with strict consumer flags
//      (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck: false`).
//
//   3. builds the starter templates (`templates/*` `build` script) against the installed packages.
//
//   node scripts/package/smoke.ts [pkg …] [--no-build] [--keep] [--templates | --no-templates]
//   (default: every packaged lib + every template)
//
// Peer tools (vite, typescript, @types/node, lucide, …) are symlinked from the workspace node_modules
// (`--legacy-peer-deps`: npm would otherwise fetch them, and the offline cache may not hold every version).
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildPackage, targetsOf } from "./build.ts";

const ROOT = resolve(import.meta.dirname, "../..");
/** Packaged libs in dependency order (`libs/<name>`). */
export const PACKAGES = [
  "reactivity",
  "runtime",
  "compiler",
  "router",
  "kit",
  "forms",
  "i18n",
  "testing",
  "language-core",
  "devtools",
  "typescript-plugin",
  "mcp",
  "cdk",
  "ui",
  "motion",
  "bridge",
  "bridge-react",
  "bridge-preact",
  "create-rivet",
  "nx",
];
/** Peers / tools a consumer brings itself: linked from the workspace instead of installed. */
const PEERS = [
  "vite",
  "typescript",
  "@types/node",
  "lucide",
  "@capsizecss/metrics",
  "@capsizecss/unpack",
  "happy-dom",
  "vitest",
  "playwright",
  "sharp",
  "@tailwindcss/vite",
  "tailwindcss",
  "nx",
  // @rivetjs/motion peer (motion.dev).
  "motion",
  // Framework bridge consumers supply React/Preact and React's declaration packages.
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
  "preact",
  "preact-render-to-string",
];
/** Starter templates the full run builds (router + compiler + runtime + reactivity + devtools; starter-ui also kit + cdk + ui). */
export const TEMPLATES = ["starter-minimal", "starter-static", "starter-server", "starter-ui"];
/** Subpaths that need a host the smoke project does not provide (a test runner, a browser page): types only. */
const HOST_ONLY = new Set([
  "@rivetjs/runtime/testing/register",
  "@rivetjs/testing/node-env",
  // Vitest browser-mode setup file: installs the headless cursor guard on `window` (tester frame).
  "@rivetjs/testing/browser-env",
  "@rivetjs/testing/jest",
  "@rivetjs/testing/jasmine",
  "@rivetjs/testing/jest-dom",
  "@rivetjs/testing/cleanup",
  "@rivetjs/devtools/agent",
]);

/**
 * Runtime imports of another package that its manifest must declare as a peer (one copy in the app: the compiler's wasm,
 * shared module state). language-core imports `@rivetjs/compiler/codes` / `/format` and loads the app's compiler.
 */
export const REQUIRED_PEERS: Record<string, string[]> = { "@rivetjs/language-core": ["@rivetjs/compiler"] };

interface Failure {
  step: string;
  detail: string;
}

/** `dist`: where the packages are (built) — `dist/libs` by default; tests pass a temp directory. */
export function smoke(names: string[], { build = true, keep = false, dist: distRoot = join(ROOT, "dist/libs"), templates = [] as string[] } = {}): Failure[] {
  const failures: Failure[] = [];
  const work = mkdtempSync(join(tmpdir(), "rivet-pack-"));
  const tarballs = join(work, "tarballs");
  const app = join(work, "app");
  mkdirSync(tarballs);
  mkdirSync(app);
  const manifests = new Map<string, { tarball: string; exports?: Record<string, Parameters<typeof targetsOf>[0]>; dependencies?: Record<string, string> }>();
  for (const name of names) {
    const dist = join(distRoot, name);
    if (build) {
      // Sources are type-checked by the typecheck gate; this checks what consumers see (.d.ts below).
      const result = buildPackage(join("libs", name), dist, { typecheck: false });
      for (const warning of result.warnings) failures.push({ step: "build " + name, detail: warning });
    }
    if (!existsSync(join(dist, "package.json"))) {
      failures.push({ step: "build " + name, detail: dist + " missing (run nx run " + name + ":package)" });
      continue;
    }
    const file = execFileSync("npm", ["pack", dist, "--pack-destination", tarballs, "--silent"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").pop()!;
    const manifest = JSON.parse(readFileSync(join(dist, "package.json"), "utf8"));
    for (const peer of REQUIRED_PEERS[manifest.name] ?? [])
      if (!manifest.peerDependencies?.[peer]) failures.push({ step: "manifest " + name, detail: `${manifest.name}: "${peer}" must be a peerDependency` });
    manifests.set(manifest.name, { tarball: join(tarballs, file), exports: manifest.exports, dependencies: manifest.dependencies });
  }
  const dependencies: Record<string, string> = Object.fromEntries([...manifests].map(([name, { tarball }]) => [name, "file:" + tarball]));
  // Third-party dependencies of the packages (lucide, @formatjs/*, …) come from the workspace install (npm links a
  // `file:` directory): the offline install never reaches the registry, and an empty npm cache does not fail it.
  for (const { dependencies: deps } of manifests.values())
    for (const dep of Object.keys(deps ?? {}))
      if (!manifests.has(dep) && existsSync(join(ROOT, "node_modules", dep, "package.json"))) dependencies[dep] = "file:" + join(ROOT, "node_modules", dep);
  writeFileSync(
    join(app, "package.json"),
    JSON.stringify(
      {
        name: "rivet-pack-smoke",
        private: true,
        type: "module",
        dependencies,
        overrides: Object.fromEntries(Object.keys(dependencies).map((name) => [name, "$" + name])),
      },
      null,
      2,
    ),
  );
  const install = spawnSync("npm", ["install", "--offline", "--legacy-peer-deps", "--no-audit", "--no-fund", "--ignore-scripts", "--loglevel=error"], {
    cwd: app,
    encoding: "utf8",
  });
  if (install.status !== 0) return [...failures, { step: "npm install", detail: install.stderr }];
  for (const peer of PEERS) {
    const from = join(ROOT, "node_modules", peer);
    const to = join(app, "node_modules", peer);
    if (existsSync(from) && !existsSync(to)) {
      mkdirSync(dirname(to), { recursive: true });
      symlinkSync(from, to);
    }
  }

  // 1. Runtime imports.
  const runtime: string[] = [];
  const jsx: string[] = [];
  const typed: string[] = [];
  for (const [name, manifest] of manifests) {
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
      if (key.includes("*") || key === "./package.json") continue;
      const specifier = key === "." ? name : name + "/" + key.slice(2);
      const targets = targetsOf(value);
      if (targets.some((target) => /\.d\.ts$/.test(target))) typed.push(specifier);
      const code = targets.filter((target) => /\.jsx?$/.test(target));
      if (!code.length || HOST_ONLY.has(specifier)) continue;
      (code.some((target) => target.endsWith(".jsx")) ? jsx : runtime).push(specifier);
    }
  }
  // A plain-Node import that reaches a `.jsx` module (`router/client` → `link.jsx`) needs the Rivet compiler:
  // it moves to the compiled runs instead of failing.
  const importAll = (specifiers: string[], plain: boolean) =>
    `const failed = [], compiled = [];\nfor (const s of ${JSON.stringify(specifiers)}) {\n` +
    `  try { await import(s); } catch (e) {\n` +
    (plain ? `    if (e?.code === "ERR_UNKNOWN_FILE_EXTENSION" && e.message.includes(".jsx")) { compiled.push(s); continue; }\n` : "") +
    `    failed.push(s + ": " + String(e?.stack ?? e).split("\\n").slice(0, 3).join(" | "));\n  }\n}\n` +
    `if (failed.length) { console.error(failed.join("\\n")); process.exit(1); }\nconsole.log(JSON.stringify({ ok: ${specifiers.length} - compiled.length, compiled }));\n`;
  writeFileSync(join(app, "imports.mjs"), importAll(runtime, true));
  const counts: string[] = [];
  const node = (step: string, args: string[], env: Record<string, string> = {}): { ok: number; compiled: string[] } | null => {
    const run = spawnSync(process.execPath, args, { cwd: app, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "", ...env } });
    if (run.status !== 0) {
      failures.push({ step, detail: (run.stderr || run.stdout).trim() });
      return null;
    }
    const result = JSON.parse(run.stdout.trim().split("\n").pop()!) as { ok: number; compiled: string[] };
    counts.push(`${step}: ${result.ok} subpaths ok${result.compiled.length ? ` (${result.compiled.length} need the compiler)` : ""}`);
    return result;
  };
  const plain = node("node imports", ["imports.mjs"]);
  node("node imports (development)", ["--conditions=development", "imports.mjs"]);
  const compiledSpecifiers = [...jsx, ...(plain?.compiled ?? [])];
  if (compiledSpecifiers.length && manifests.has("@rivetjs/compiler")) {
    writeFileSync(join(app, "imports-jsx.mjs"), importAll(compiledSpecifiers, false));
    node("node imports via Rivet loader (dom)", ["--import", "@rivetjs/runtime/testing/register", "imports-jsx.mjs"]);
    // The explicit DOM island ABI imports `_dom`; it is tested above in its browser target, never server-rewritten.
    writeFileSync(
      join(app, "imports-jsx-server.mjs"),
      importAll(
        compiledSpecifiers.filter((specifier) => specifier !== "@rivetjs/bridge/dom"),
        false,
      ),
    );
    node("node imports via Rivet loader (server)", ["--import", "@rivetjs/runtime/testing/register", "imports-jsx-server.mjs"], {
      RIVET_TEST_TARGET: "server",
    });
  }

  // Build constants the router's Vite plugin rewrites (`TRAILING_SLASH`, `SHELL_BUILD`): the published `.js` has the
  // type casts stripped, so the plugin's patterns must match that form too (libs/router/tests/build-constants.test.ts).
  if (manifests.has("@rivetjs/router") && manifests.has("@rivetjs/compiler")) {
    writeFileSync(
      join(app, "router-constants.mjs"),
      `import { readFileSync } from "node:fs";\nimport { fileURLToPath } from "node:url";\nimport { rivetRouter } from "@rivetjs/router/vite";\n` +
        `const dir = fileURLToPath(new URL("./node_modules/@rivetjs/router/", import.meta.url));\n` +
        `const run = (options, file, expect) => {\n` +
        `  const plugin = rivetRouter(options).find((p) => p.name === "vite-plugin-rivet-router");\n` +
        `  const out = plugin.transform.call({ error(m) { throw new Error(m); } }, readFileSync(dir + file, "utf8"), dir + file, { ssr: true });\n` +
        `  if (!out || !expect.test(out.code)) throw new Error(file + ": build constant not rewritten");\n};\n` +
        `run({ trailingSlash: "never" }, "shared/slash.js", /TRAILING_SLASH = "never";/);\n` +
        `run({ routeRules: { "/s/**": { shell: true } } }, "server/shell-build.js", /SHELL_BUILD = \\(\\) => import\\(/);\n` +
        `console.log(JSON.stringify({ ok: 2, compiled: [] }));\n`,
    );
    node("router build constants", ["router-constants.mjs"]);
  }

  // 2. Consumer type-check. Script declarations (`client.d.ts`: ambient `declare module "*?image"`) are referenced.
  const ambient: string[] = [];
  const modules: string[] = [];
  for (const specifier of typed) {
    // `@scope/name/sub` → `@scope/name`; unscoped `create-rivet/deploy` → `create-rivet`.
    const name = specifier
      .split("/")
      .slice(0, specifier.startsWith("@") ? 2 : 1)
      .join("/");
    const key = specifier === name ? "." : "./" + specifier.slice(name.length + 1);
    const types = targetsOf(manifests.get(name)!.exports![key]!).find((target) => target.endsWith(".d.ts"))!;
    const text = readFileSync(join(app, "node_modules", name, types), "utf8");
    (/^(?:export|import)\b/m.test(text) ? modules : ambient).push(specifier);
  }
  writeFileSync(
    join(app, "consumer.tsx"),
    ambient.map((specifier) => `/// <reference types=${JSON.stringify(specifier)} />`).join("\n") +
      "\n" +
      modules.map((specifier, i) => `import type * as m${i} from ${JSON.stringify(specifier)};`).join("\n") +
      `\nexport type All = [${modules.map((_, i) => `typeof m${i}`).join(", ")}];\n` +
      (manifests.has("@rivetjs/reactivity") && manifests.has("@rivetjs/runtime")
        ? `import { signal } from "@rivetjs/reactivity";\nconst count = signal(0);\nexport const view = <button type="button" onClick={() => count.set(count() + 1)}>{count()}</button>;\n`
        : ""),
  );
  writeFileSync(
    join(app, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "es2023",
          lib: ["es2023", "dom", "dom.iterable"],
          module: "nodenext",
          moduleResolution: "nodenext",
          strict: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          verbatimModuleSyntax: true,
          skipLibCheck: false,
          noEmit: true,
          jsx: "preserve",
          jsxImportSource: "@rivetjs/runtime",
          types: ["node"],
        },
        files: ["consumer.tsx"],
      },
      null,
      2,
    ),
  );
  const tsc = spawnSync(process.execPath, [join(ROOT, "node_modules/typescript/bin/tsc"), "-p", "."], { cwd: app, encoding: "utf8" });
  // Errors inside the peers' own declarations (vite, @types/node) are theirs, not the packages'.
  const errors = tsc.stdout.split("\n").filter((line) => /error TS/.test(line) && !/^\S*node_modules\/(?!@rivetjs\/)/.test(line));
  if (errors.length) failures.push({ step: `tsc (${typed.length} typed subpaths)`, detail: errors.join("\n") });
  else counts.push(`tsc: ${typed.length} typed subpaths ok`);

  // 3. Starter templates built against the installed packages (`npm run build` steps; `vite` from the workspace).
  for (const template of templates) {
    const from = join(ROOT, "templates", template);
    const at = join(app, "templates", template);
    cpSync(from, at, { recursive: true, filter: (path) => !/[/\\](?:node_modules|dist|\.rivet)(?:[/\\]|$)/.test(path.slice(from.length)) });
    symlinkSync(join(app, "node_modules"), join(at, "node_modules"));
    const { scripts } = JSON.parse(readFileSync(join(at, "package.json"), "utf8")) as { scripts: Record<string, string> };
    let ok = true;
    for (const command of scripts["build"]!.split("&&").map((part) => part.trim().split(/\s+/))) {
      const [tool, ...args] = command as [string, ...string[]];
      const argv = tool === "vite" ? [join(app, "node_modules/vite/bin/vite.js"), ...args] : tool === "node" ? args : null;
      if (!argv) {
        failures.push({ step: `template ${template}`, detail: `unsupported build step: ${command.join(" ")}` });
        ok = false;
        break;
      }
      const run = spawnSync(process.execPath, argv, { cwd: at, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } });
      if (run.status !== 0) {
        failures.push({ step: `template ${template}: ${command.join(" ")}`, detail: (run.stderr || run.stdout).trim().split("\n").slice(0, 12).join("\n") });
        ok = false;
        break;
      }
    }
    if (ok) counts.push(`template ${template}: build ok`);
  }

  console.log(counts.join("\n"));
  if (!keep) rmSync(work, { recursive: true, force: true });
  else console.log("kept " + work);
  return failures;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const names = args.filter((arg) => !arg.startsWith("--"));
  const all = !names.length;
  const failures = smoke(all ? PACKAGES.filter((name) => existsSync(join(ROOT, "libs", name))) : names, {
    build: !flags.has("--no-build"),
    keep: flags.has("--keep"),
    templates: flags.has("--no-templates") ? [] : all || flags.has("--templates") ? TEMPLATES : [],
  });
  for (const failure of failures) console.error(`FAIL ${failure.step}\n  ${failure.detail.replaceAll("\n", "\n  ")}`);
  if (failures.length) process.exit(1);
  console.log("pack smoke: ok");
}
