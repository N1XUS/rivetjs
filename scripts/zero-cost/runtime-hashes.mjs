// Minified Rolldown hash per public @rivetjs/reactivity and @rivetjs/runtime entry (production resolution).
// Usage: node scripts/zero-cost/runtime-hashes.mjs <repo root>
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
// The switch modules' opted-in content: the compiler plugin's own table (`libs/compiler/switches.ts`).
const { DERIVED_SWITCHES, DOM_DATA_SWITCHES, switchContent } = await import(pathToFileURL(`${root}/libs/compiler/switches.ts`).href);
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
// Unbracketed lines: the files as written — what server builds and builds without `resume` get (0 bytes of the adopt run).
const PLAIN = [];
// `[resumed]` lines: the browser entries of a resume build (`rivet({ resume })` / `rivetRouter()`: the compiler plugin serves
// the adopt run's switches, `DERIVED` + `LAZY_ROWS`, to every browser module — `libs/compiler/vite.ts` `derivedSwitch`).
const RESUMED = [switches("resumed-switches", [...DERIVED_SWITCHES])];
// `[domData]` lines (where they differ from the `[resumed]` one): a `resume: { domData: true }` build (browser: the adopt switches + `DOM_DATA`; server: `dom-data-derived`).
const DOM_DATA = [switches("dom-data-switches", [...DERIVED_SWITCHES, ...DOM_DATA_SWITCHES])];
const hash = async (input, plugins) => {
  const bundle = await rolldown({
    input, platform: "node", logLevel: "silent", plugins,
    external: [/^node:/, /^@rivetjs\/compiler/], resolve: { conditionNames: ["import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  // The entry's static import closure.
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
  return line;
};
for (const pkg of ["libs/reactivity", "libs/runtime"]) {
  const json = JSON.parse(readFileSync(`${root}/${pkg}/package.json`, "utf8"));
  for (const [key, value] of Object.entries(json.exports)) {
    const file = typeof value === "string" ? value : value.default ?? value.import;
    const name = json.name + key.slice(1);
    const input = `${root}/${pkg}/${file}`;
    const line = await hash(input, PLAIN);
    out.push(`${name} ${line}`);
    const resumed = await hash(input, RESUMED);
    if (resumed !== line) out.push(`${name} [resumed] ${resumed}`);
    const domData = await hash(input, DOM_DATA);
    if (domData !== resumed) out.push(`${name} [domData] ${domData}`);
  }
}
console.log(out.join("\n"));
