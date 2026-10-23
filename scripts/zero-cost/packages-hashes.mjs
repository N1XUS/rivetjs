// Minified Rolldown hash per public runtime entry of @rivetjs/router, forms, i18n, kit, ui, motion, bridge, bridge-react and bridge-preact (production resolution),
// plus the cdk entries listed in CDK_ENTRIES (masonry, flip and scheduler).
// Each entry is hashed as the package's own code: other `@rivetjs/*` packages, third-party packages and `node:*`
// stay external (reactivity + runtime are gated by runtime-hashes.mjs; import specifiers still show in the hash).
// `#` specifiers (the package's `imports` map) are own code: resolved with the production conditions and inlined.
// `.tsx` modules are compiled with @rivetjs/compiler like a production build; an entry whose graph has a `.tsx`
// module gets a `[dom]` and a `[server]` line. Exports with a `browser` condition get a `[browser]` line.
// Build-time entries (Vite plugins, route codegen), stylesheets and types-only exports are not runtime and skipped.
// Stylesheets a module imports (`@rivetjs/ui` per-component CSS, `import "../../../out/button.css"`) stay external (Rolldown
// does not bundle CSS); the entry's line gains `css <hash> <bytes>` over the files it reaches (sorted, contents joined),
// so a component's CSS bytes are gated with its JS.
// Usage: node scripts/zero-cost/packages-hashes.mjs <repo root>
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
const root = process.argv[2];
const { rolldown } = await import(createRequire(root + "/package.json").resolve("rolldown"));
const { compile } = await import(`${root}/libs/compiler/index.ts`);
const PACKAGES = ["libs/router", "libs/forms", "libs/i18n", "libs/kit", "libs/ui", "libs/motion", "libs/bridge", "libs/bridge-react", "libs/bridge-preact"];
/** Gated `@rivetjs/cdk` entries: name → file (relative to libs/cdk). */
const CDK_ENTRIES = [
  ["@rivetjs/cdk/masonry", "masonry/index.tsx"],
  ["@rivetjs/cdk/masonry/behaviour", "masonry/behaviour.ts"],
  ["@rivetjs/cdk/flip", "flip/index.ts"],
  ["@rivetjs/cdk/scheduler", "scheduler/index.tsx"],
  ["@rivetjs/cdk/scheduler/layout", "scheduler/layout-index.ts"],
];
/** Build-time (Node/Vite) entries: never in a shipped bundle. */
const BUILD_ONLY = new Set([
  "@rivetjs/router/vite",
  "@rivetjs/router/routes",
  "@rivetjs/i18n/vite",
  "@rivetjs/kit/vite",
  "@rivetjs/bridge/vite",
  "@rivetjs/bridge-react/vite",
  "@rivetjs/bridge-preact/vite",
]);

/** Compiles `.tsx` modules for `target`; `seen.tsx` reports whether the graph had one. */
function rivet(target, seen) {
  return {
    name: "rivet-compile",
    transform(source, id) {
      if (!id.endsWith(".tsx")) return null;
      seen.tsx = true;
      const result = compile(source, { target, filename: id });
      if (result.diagnostics.length) throw new Error(`${id}: ${result.diagnostics.map((d) => d.message).join("; ")}`);
      return { code: result.code, moduleType: "ts" };
    },
  };
}

async function hash(input, { target, browser }) {
  const seen = { tsx: false };
  const css = new Set();
  const bundle = await rolldown({
    input,
    platform: browser ? "browser" : "node",
    logLevel: "silent",
    // Bare specifiers (other packages, including other @rivetjs packages) and node:* are external. `#` specifiers are
    // the package's own `imports` map (e.g. `@rivetjs/ui` `#dev`): resolved with the production conditions, as an app does.
    external: (id, importer) => {
      if (id.endsWith(".css")) {
        css.add(id.startsWith(".") && importer ? resolve(dirname(importer), id) : id);
        return true;
      }
      return id.startsWith("node:") || !(id.startsWith(".") || id.startsWith("/") || id.startsWith("\0") || id.startsWith("#"));
    },
    resolve: { conditionNames: browser ? ["browser", "import", "production", "default"] : ["import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    plugins: [rivet(target, seen)],
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  const code = output[0].code;
  let line = `${createHash("sha256").update(code).digest("hex").slice(0, 12)} ${code.length}`;
  if (css.size) {
    const sheets = [...css]
      .sort()
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    line += ` css ${createHash("sha256").update(sheets).digest("hex").slice(0, 12)} ${Buffer.byteLength(sheets)}`;
  }
  return { line, tsx: seen.tsx };
}

/** Public runtime entries: `{ name, file, browser? }` (file relative to the package dir). */
function entries(pkg) {
  const json = JSON.parse(readFileSync(`${root}/${pkg}/package.json`, "utf8"));
  const list = [];
  for (const [key, value] of Object.entries(json.exports)) {
    const name = json.name + key.slice(1);
    if (BUILD_ONLY.has(name) || typeof value === "string") continue; // stylesheets
    const file = value.default ?? value.import;
    if (!file || file.endsWith(".css")) continue; // types-only, or a stylesheet entry with conditions (`@rivetjs/ui/styles`)
    list.push({ name, file, browser: value.browser });
  }
  return list;
}

const out = [];
for (const pkg of PACKAGES) {
  for (const { name, file, browser } of entries(pkg)) {
    const input = `${root}/${pkg}/${file}`;
    const dom = await hash(input, { target: "dom" });
    if (!dom.tsx) out.push(`${name} ${dom.line}`);
    else {
      out.push(`${name} [dom] ${dom.line}`);
      out.push(`${name} [server] ${(await hash(input, { target: "server" })).line}`);
    }
    if (browser) out.push(`${name} [browser] ${(await hash(`${root}/${pkg}/${browser}`, { target: "dom", browser: true })).line}`);
  }
}
for (const [name, file] of CDK_ENTRIES) {
  const input = `${root}/libs/cdk/${file}`;
  const dom = await hash(input, { target: "dom" });
  if (!dom.tsx) out.push(`${name} ${dom.line}`);
  else {
    out.push(`${name} [dom] ${dom.line}`);
    out.push(`${name} [server] ${(await hash(input, { target: "server" })).line}`);
  }
}
console.log(out.join("\n"));
