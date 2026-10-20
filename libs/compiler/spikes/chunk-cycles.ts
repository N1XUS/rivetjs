// Chunk cycle census (CHUNK-CYCLE 2026-10-20): the static import graph of every emitted `.js` chunk of a client build
// (relative `import … from "./x.js"` / `import "./x.js"`, `.deps.js` lists skipped) and its strongly connected components
// of more than one chunk — two chunks importing each other evaluate in an order the source never had (a merge chunk
// reading a binding its importer has not defined yet).
//
//   node libs/compiler/spikes/chunk-cycles.ts <client dir>      e.g. apps/docs/dist/client
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? ".");
const files: string[] = [];
const walk = (d: string): void => {
  for (const name of readdirSync(d)) {
    const path = join(d, name);
    if (statSync(path).isDirectory()) {
      if (name !== ".vite" && name !== "node_modules") walk(path);
    } else if (name.endsWith(".js") && !name.endsWith(".deps.js")) files.push(path);
  }
};
walk(dir);
const emitted = new Set(files);
const edges = new Map<string, string[]>();
for (const file of files) {
  const code = readFileSync(file, "utf8");
  const out = new Set<string>();
  for (const m of code.matchAll(/(?:\bfrom|\bimport)\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) out.add(resolve(dirname(file), m[1]!));
  out.delete(file);
  edges.set(
    file,
    [...out].filter((next) => emitted.has(next)),
  );
}
// Tarjan (iterative enough for chunk graphs: depth = longest static import chain).
let counter = 0;
const stack: string[] = [],
  onStack = new Set<string>(),
  index = new Map<string, number>(),
  low = new Map<string, number>(),
  cycles: string[][] = [];
const connect = (v: string): void => {
  index.set(v, counter);
  low.set(v, counter++);
  stack.push(v);
  onStack.add(v);
  for (const w of edges.get(v) ?? []) {
    if (!index.has(w)) {
      connect(w);
      low.set(v, Math.min(low.get(v)!, low.get(w)!));
    } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
  }
  if (low.get(v) !== index.get(v)) return;
  const component: string[] = [];
  let w: string;
  do {
    w = stack.pop()!;
    onStack.delete(w);
    component.push(w);
  } while (w !== v);
  if (component.length > 1) cycles.push(component);
};
for (const file of files) if (!index.has(file)) connect(file);
const merged = cycles.filter((component) => component.some((file) => /rivet-merge-/.test(file)));
console.log(`${relative(process.cwd(), dir) || "."}: ${files.length} chunks, ${cycles.length} static cycles, ${merged.length} with a rivet-merge- chunk`);
for (const component of cycles)
  console.log(
    "  " +
      component
        .map((file) => relative(dir, file))
        .sort()
        .join(" <-> "),
  );
