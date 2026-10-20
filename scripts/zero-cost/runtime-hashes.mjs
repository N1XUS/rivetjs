// Minified Rolldown hash per public @rivetjs/reactivity and @rivetjs/runtime entry (production resolution).
// Usage: node scripts/zero-cost/runtime-hashes.mjs <repo root>
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const root = process.argv[2];
const { rolldown } = await import(createRequire(root + "/package.json").resolve("rolldown"));
const out = [];
// `[lazyRows]` lines: the entries a `rivet({ resume: { lazyRows: true } })` build gets (the compiler plugin's switch
// modules, `libs/compiler/vite.ts` `lazySwitch`); every other line is a build without it (LAZY-T5B: identical to before).
const LAZY = [
  {
    name: "lazy-rows-switch",
    load(id) {
      const hit = /[\\/]libs[\\/]runtime[\\/](lazy-rows(?:-resume)?)\.ts$/.exec(id);
      if (hit) return hit[1] === "lazy-rows" ? "export const LAZY_ROWS = true;\n" : 'export { _lazyRows } from "./dom-resume-lazy.ts";\n';
    },
  },
];
// `[domData]` lines: the resume entry and the resumable server of a `rivet({ resume: { domData: true } })` build (DOM-DATA,
// `domDataSwitch`).
const DOM_DATA = [
  {
    name: "dom-data-switch",
    load(id) {
      const hit = /[\\/]libs[\\/]runtime[\\/](dom-data(?:-resume|-server)?)\.ts$/.exec(id);
      if (!hit) return;
      if (hit[1] === "dom-data") return "export const DOM_DATA = true;\n";
      if (hit[1] === "dom-data-server") return 'import { _domRegistry } from "./server-dom-data.ts";\nexport const domServer = { create: _domRegistry };\n';
      return 'export { _domData } from "./dom-resume-data.ts";\n';
    },
  },
];
const hash = async (input, plugins) => {
  const bundle = await rolldown({
    input, platform: "node", logLevel: "silent", plugins,
    external: [/^node:/, /^@rivetjs\/compiler/], resolve: { conditionNames: ["import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  const code = output[0].code;
  return `${createHash("sha256").update(code).digest("hex").slice(0, 12)} ${code.length}`;
};
for (const pkg of ["libs/reactivity", "libs/runtime"]) {
  const json = JSON.parse(readFileSync(`${root}/${pkg}/package.json`, "utf8"));
  for (const [key, value] of Object.entries(json.exports)) {
    const file = typeof value === "string" ? value : value.default ?? value.import;
    out.push(`${json.name}${key.slice(1)} ${await hash(`${root}/${pkg}/${file}`, [])}`);
    if (key === "./dom" || key === "./dom-resume") out.push(`${json.name}${key.slice(1)} [lazyRows] ${await hash(`${root}/${pkg}/${file}`, LAZY)}`);
    if (key === "./dom-resume" || key === "./server-resume") out.push(`${json.name}${key.slice(1)} [domData] ${await hash(`${root}/${pkg}/${file}`, DOM_DATA)}`);
  }
}
console.log(out.join("\n"));
