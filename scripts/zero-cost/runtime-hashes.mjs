// Minified Rolldown hash per public @rivetjs/reactivity and @rivetjs/runtime entry (production resolution).
// Usage: node scripts/zero-cost/runtime-hashes.mjs <repo root>
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const root = process.argv[2];
const { rolldown } = await import(createRequire(root + "/package.json").resolve("rolldown"));
const out = [];
for (const pkg of ["libs/reactivity", "libs/runtime"]) {
  const json = JSON.parse(readFileSync(`${root}/${pkg}/package.json`, "utf8"));
  for (const [key, value] of Object.entries(json.exports)) {
    const file = typeof value === "string" ? value : value.default ?? value.import;
    const bundle = await rolldown({
      input: `${root}/${pkg}/${file}`, platform: "node", logLevel: "silent",
      external: [/^node:/, /^@rivetjs\/compiler/], resolve: { conditionNames: ["import", "production", "default"] },
      transform: { define: { "process.env.NODE_ENV": '"production"' } },
    });
    const { output } = await bundle.generate({ format: "esm", minify: true });
    const code = output[0].code;
    out.push(`${json.name}${key.slice(1)} ${createHash("sha256").update(code).digest("hex").slice(0, 12)} ${code.length}`);
  }
}
console.log(out.join("\n"));
