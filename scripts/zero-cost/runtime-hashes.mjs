// Minified Rolldown hash per public @rivetjs/reactivity and @rivetjs/runtime entry (production resolution).
// Usage: node scripts/zero-cost/runtime-hashes.mjs <repo root>
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
// The switch modules' opted-in content: the compiler plugin's own table (`libs/compiler/switches.ts`).
const { DERIVED_SWITCHES, DOM_DATA_SWITCHES, LAZY_SWITCHES, switchContent } = await import(pathToFileURL(`${root}/libs/compiler/switches.ts`).href);
/** A plugin loading the opted-in content of the runtime switch modules `names`. */
const switches = (name, names) => ({
  name,
  load(id) {
    const hit = /[\\/]libs[\\/]runtime[\\/]([\w-]+)\.ts$/.exec(id);
    if (hit && names.includes(hit[1])) return switchContent(hit[1], (module) => `./${module}.ts`);
  },
});
const { rolldown } = await import(createRequire(root + "/package.json").resolve("rolldown"));
const out = [];
// Unbracketed lines: the entries a default resume build gets (`rivet({ resume })` / `rivetRouter()`: `resume.lazyRows` and
// `resume.domData` default true since LAZY-FLIP 2026-10-22, so the compiler plugin serves the lazy rows + DOM data switch
// modules to every module of both targets — `libs/compiler/vite.ts` `lazySwitch` / `domDataSwitch`).
const DEFAULT = [switches("default-resume-switches", [...LAZY_SWITCHES, ...DOM_DATA_SWITCHES])];
// `[opt-out]` lines (only where they differ from the default line): the switch files as written — a build with
// `resume: { lazyRows: false, domData: false }`, and every build without `resume` (0 bytes of either feature).
const OPT_OUT = [];
// `[derived]` lines: the browser entries of a `rivet({ resume: { model: "derived" } })` build (M2 lane R: the derived switch
// + the lazy rows switches its adopt run needs; the derived model ignores `lazyRows` / `domData`).
const DERIVED = [switches("derived-switch", [...LAZY_SWITCHES, ...DERIVED_SWITCHES])];
const DERIVED_ONLY = ["./server-derived", "./dom-derived"];
const hash = async (input, plugins, lazy) => {
  const bundle = await rolldown({
    input: lazy ? [input, `${root}/libs/runtime/dom-resume-lazy.ts`] : input, platform: "node", logLevel: "silent", plugins,
    external: [/^node:/, /^@rivetjs\/compiler/], resolve: { conditionNames: ["import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  // The entry's static import closure: one chunk, unless another entry splits shared modules off (default `/dom-resume`:
  // bundled with `dom-resume-lazy.ts`, the lazy rows runtime, an emitted chunk of those builds — LAZY-BLOCKERS — whose own
  // chunk gets a `[lazyRows chunk]` line).
  const byName = new Map(output.map((chunk) => [chunk.fileName, chunk]));
  const closure = [];
  const walk = (chunk) => {
    if (!chunk || closure.includes(chunk)) return;
    closure.push(chunk);
    for (const name of chunk.imports ?? []) walk(byName.get(name));
  };
  const main = output.find((chunk) => chunk.isEntry && chunk.facadeModuleId?.endsWith("/" + input.split("/").pop())) ?? output[0];
  walk(main);
  const code = closure.map((chunk) => chunk.code).join("\n");
  const line = `${createHash("sha256").update(code).digest("hex").slice(0, 12)} ${closure.reduce((n, chunk) => n + chunk.code.length, 0)}`;
  if (lazy) for (const chunk of output) if (chunk.type === "chunk" && chunk.isEntry && chunk !== main) lazy.push(`${createHash("sha256").update(chunk.code).digest("hex").slice(0, 12)} ${chunk.code.length}`);
  return line;
};
for (const pkg of ["libs/reactivity", "libs/runtime"]) {
  const json = JSON.parse(readFileSync(`${root}/${pkg}/package.json`, "utf8"));
  for (const [key, value] of Object.entries(json.exports)) {
    const file = typeof value === "string" ? value : value.default ?? value.import;
    const name = json.name + key.slice(1);
    const input = `${root}/${pkg}/${file}`;
    const chunks = [];
    // The derived model's own entries: only derived builds import them, and those flip neither switch set (their browser
    // half: the `[derived]` line) — files as written.
    const line = await hash(input, DERIVED_ONLY.includes(key) ? OPT_OUT : DEFAULT, key === "./dom-resume" ? chunks : undefined);
    out.push(`${name} ${line}`);
    for (const chunk of chunks) out.push(`${name} [lazyRows chunk] ${chunk}`);
    const optOut = await hash(input, OPT_OUT);
    if (optOut !== line) out.push(`${name} [opt-out] ${optOut}`);
    if (key === "./dom" || key === "./dom-derived") out.push(`${name} [derived] ${await hash(input, DERIVED)}`);
  }
}
console.log(out.join("\n"));
