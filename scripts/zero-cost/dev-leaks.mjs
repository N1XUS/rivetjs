// No development code in production: every public runtime entry of @rivetjs/reactivity, runtime, router, forms,
// i18n, kit, ui, motion and bridge, bundled with production conditions (all @rivetjs packages and `#` imports inlined, `.tsx`
// compiled), must not include a development façade module nor a devtools event / hook string nor a dev-only
// warning text. The development resolution of each façade (`exports` and `imports` `development` targets) must
// select it (so the check can fail). Prints `dev leaks: none (N entries)`; exits 1 on a leak.
// Usage: node scripts/zero-cost/dev-leaks.mjs <repo root>
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const root = process.argv[2];
const { rolldown } = await import(createRequire(root + "/package.json").resolve("rolldown"));
const { compile } = await import(`${root}/libs/compiler/index.ts`);

/** Development façades (`development` export condition) and the devtools-only modules they pull in. */
const DEV_FILES = [
  "libs/reactivity/dev.ts",
  "libs/reactivity/debug.ts",
  "libs/runtime/dev/dom.ts",
  "libs/runtime/dev/on.ts",
  "libs/runtime/dev/kb.ts",
  "libs/runtime/dev/where.ts",
  "libs/router/client/dev.ts",
  "libs/forms/dev.ts",
  "libs/forms/autosave-dev.ts",
  "libs/ui/src/utils/dev-on.ts",
  "libs/cdk/utils/dev-on.ts",
  "libs/bridge/dev-on.ts",
];
/** Devtools protocol events and the hook global (`libs/devtools/protocol.ts`). */
const DEV_STRINGS = [
  "rivet.devtools",
  "hot.update",
  "hot.register",
  "hot.reset",
  "sig.write",
  "sig.create",
  "sig.internal",
  "comp.mount",
  "comp.unmount",
  "comp.hide",
  "dom.update",
  "error.hint",
  "error.request",
  "lib.register",
  "lib.changed",
  "lib.form",
  "lib.autosave",
  "lib.router",
  // Dev warning locations (runtime dev/where.ts, compiler dev stamps, cdk dev-on.ts `devWhere`).
  "rivet.locate",
  "rivet.sources",
];
/** Dev-only warning texts (prefixes) behind a `#dev` flag (`if (DEV && …) console.warn(…)`). */
const DEV_MESSAGES = [
  "Ref was not connected to DOM element returned by custom",
  "Avatar: Only one `Avatar.Image` component should be rendered per `Avatar.Root`",
  // ui ColorSlider `getValidColorSpace` auto-correction warning.
  "[HeroUI ColorSlider] Invalid combination",
  // bridge client driver / DOM `_island` dev warnings.
  " failed to hydrate, mounting instead",
  " has no loader: it renders its fallback only",
  " called after its island unmounted: ignored",
  // ui shorthand precedence (`utils/shorthand.ts`: children win over label / items).
  "[rivet ui] ",
  // cdk `server-off.ts`: a server bundle resolving the `browser` condition (no slot probe).
  "[rivet cdk] cdk slot probe is disabled",
];
/** Entries that are development tools themselves. */
const DEV_ENTRIES = new Set(["@rivetjs/reactivity/debug", "@rivetjs/runtime/hot", "@rivetjs/runtime/hot-reactivity"]);
/** Build-time (Node/Vite) entries: never in a shipped bundle. */
const BUILD_ONLY = new Set(["@rivetjs/router/vite", "@rivetjs/router/routes", "@rivetjs/i18n/vite", "@rivetjs/kit/vite", "@rivetjs/bridge/vite"]);
const PACKAGES = ["libs/reactivity", "libs/runtime", "libs/router", "libs/forms", "libs/i18n", "libs/kit", "libs/ui", "libs/motion", "libs/bridge"];

const rivet = {
  name: "rivet-compile",
  transform(source, id) {
    if (!id.endsWith(".tsx")) return null;
    const result = compile(source, { target: "dom", filename: id });
    if (result.diagnostics.length) throw new Error(`${id}: ${result.diagnostics.map((d) => d.message).join("; ")}`);
    return { code: result.code, moduleType: "ts" };
  },
};

/** A string literal starting with `text` (the minifier may pick any quote; `rivet.devtools` covers `rivet.devtools.notify`). */
const literal = (code, text) => ['"', "'", "`"].some((quote) => code.includes(quote + text));

async function bundle(input, conditions, browser = false) {
  const loaded = new Set();
  const dev = conditions.includes("development");
  const build = await rolldown({
    input,
    platform: browser ? "browser" : "node",
    logLevel: "silent",
    // Third-party packages, stylesheets (`@rivetjs/ui` per-component CSS: Rolldown does not bundle CSS) and node:* stay
    // external; every @rivetjs package and `#` import (package `imports` map) is inlined.
    external: (id) =>
      id.startsWith("node:") ||
      id.endsWith(".css") ||
      id.startsWith("@rivetjs/compiler") ||
      !(id.startsWith(".") || id.startsWith("/") || id.startsWith("\0") || id.startsWith("@rivetjs/") || id.startsWith("#")),
    resolve: { conditionNames: conditions },
    transform: { define: { "process.env.NODE_ENV": dev ? '"development"' : '"production"' } },
    // `loaded` = every module in the graph: a folded constant module (`#dev` → `DEV = true`) leaves no rendered code,
    // so it is missing from `moduleIds`.
    plugins: [rivet, { name: "loaded", load: (id) => void loaded.add(id) }],
  });
  const { output } = await build.generate({ format: "esm", minify: true });
  return { code: output[0].code, modules: [...new Set([...output[0].moduleIds, ...loaded])].map((id) => id.slice(root.length + 1)) };
}

const failures = [];
let count = 0;
for (const pkg of PACKAGES) {
  const json = JSON.parse(readFileSync(`${root}/${pkg}/package.json`, "utf8"));
  // `imports` façades (`#dev`): the development resolution of some runtime entry must select each one.
  const devImports = new Map(
    Object.entries(json.imports ?? {})
      .filter(([, value]) => typeof value === "object" && value.development)
      .map(([key, value]) => [key, `${pkg}/${value.development.replace(/^\.\//, "")}`]),
  );
  const devImportsSeen = new Set();
  for (const [key, value] of Object.entries(json.exports)) {
    const name = json.name + key.slice(1);
    if (typeof value === "string" || DEV_ENTRIES.has(name) || BUILD_ONLY.has(name) || name.includes("/testing")) continue;
    const file = value.default ?? value.import;
    if (!file || file.endsWith(".css")) continue; // types-only, or a stylesheet entry with conditions (`@rivetjs/ui/styles`)
    // The entry file is picked here (rolldown applies conditions to bare imports inside the graph).
    const variants = [{ label: name, file, conditions: ["import", "production", "default"] }];
    if (value.browser) variants.push({ label: `${name} [browser]`, file: value.browser, conditions: ["browser", "import", "production", "default"] });
    for (const { label, file, conditions } of variants) {
      const { code, modules } = await bundle(`${root}/${pkg}/${file}`, conditions, conditions[0] === "browser");
      count++;
      for (const dev of DEV_FILES) if (modules.includes(dev)) failures.push(`${label} bundles ${dev}`);
      for (const text of DEV_STRINGS) if (literal(code, text)) failures.push(`${label} contains "${text}"`);
      for (const text of DEV_MESSAGES) if (literal(code, text)) failures.push(`${label} contains "${text}"`);
    }
    if (devImports.size) {
      const { modules } = await bundle(`${root}/${pkg}/${file}`, ["import", "development", "default"]);
      for (const [key, dev] of devImports) if (modules.includes(dev)) devImportsSeen.add(key);
    }
    // The façade check can fail: the development resolution selects the façade.
    if (value.development) {
      const { code } = await bundle(`${root}/${pkg}/${value.development}`, ["import", "development", "default"]);
      if (!code.includes("rivet.devtools") && !DEV_STRINGS.some((text) => literal(code, text)))
        failures.push(`${name}: development façade has no devtools code`);
    }
  }
  for (const [key, dev] of devImports)
    if (!devImportsSeen.has(key)) failures.push(`${json.name} ${key}: no entry selects ${dev} under the development condition`);
}
if (failures.length) {
  console.log(failures.map((line) => `dev leak: ${line}`).join("\n"));
  process.exit(1);
}
console.log(`dev leaks: none (${count} entries)`);
