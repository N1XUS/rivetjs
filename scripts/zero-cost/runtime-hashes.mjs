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
// `[lazyRows]` lines: the entries a `rivet({ resume: { lazyRows: true } })` build gets (the compiler plugin's switch
// modules, `libs/compiler/vite.ts` `lazySwitch`); every other line is a build without it (LAZY-T5B: identical to before).
const LAZY = [switches("lazy-rows-switch", LAZY_SWITCHES)];
// `[domData]` lines: the resume entry and the resumable server of a `rivet({ resume: { domData: true } })` build (DOM-DATA,
// `domDataSwitch`).
const DOM_DATA = [switches("dom-data-switch", DOM_DATA_SWITCHES)];
// `[derived]` lines: the browser entries of a `rivet({ resume: { model: "derived" } })` build (M2 lane R: the derived switch
// + the lazy rows switches its adopt run needs).
const DERIVED = [switches("derived-switch", [...LAZY_SWITCHES, ...DERIVED_SWITCHES])];
const hash = async (input, plugins, lazy) => {
  const bundle = await rolldown({
    input: lazy ? [input, `${root}/libs/runtime/dom-resume-lazy.ts`] : input, platform: "node", logLevel: "silent", plugins,
    external: [/^node:/, /^@rivetjs\/compiler/], resolve: { conditionNames: ["import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  // The entry's static import closure: one chunk, unless another entry splits shared modules off (`[lazyRows]` resume
  // runtime: bundled with `dom-resume-lazy.ts`, the lazy rows runtime, an emitted chunk of those builds — LAZY-BLOCKERS —
  // whose own chunk gets a `[lazyRows chunk]` line).
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
    out.push(`${json.name}${key.slice(1)} ${await hash(`${root}/${pkg}/${file}`, [])}`);
    if (key === "./dom") out.push(`${json.name}${key.slice(1)} [lazyRows] ${await hash(`${root}/${pkg}/${file}`, LAZY)}`);
    if (key === "./dom-resume") {
      const chunks = [];
      out.push(`${json.name}${key.slice(1)} [lazyRows] ${await hash(`${root}/${pkg}/${file}`, LAZY, chunks)}`);
      for (const chunk of chunks) out.push(`${json.name}${key.slice(1)} [lazyRows chunk] ${chunk}`);
    }
    if (key === "./dom" || key === "./dom-derived") out.push(`${json.name}${key.slice(1)} [derived] ${await hash(`${root}/${pkg}/${file}`, DERIVED)}`);
    if (key === "./dom-resume" || key === "./server-resume") out.push(`${json.name}${key.slice(1)} [domData] ${await hash(`${root}/${pkg}/${file}`, DOM_DATA)}`);
  }
}
console.log(out.join("\n"));
