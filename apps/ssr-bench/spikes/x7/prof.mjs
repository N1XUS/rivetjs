// Lane X7: summarise a .cpuprofile. node prof.mjs <file> [top=30]: self time per function + per-category buckets.
import { readFileSync } from "node:fs";

const profile = JSON.parse(readFileSync(process.argv[2], "utf8")),
  top = +(process.argv[3] ?? 30);
const byId = new Map(profile.nodes.map((node) => [node.id, node])),
  parent = new Map();
for (const node of profile.nodes) for (const child of node.children ?? []) parent.set(child, node.id);
const time = new Map();
profile.samples.forEach((id, i) => time.set(id, (time.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
const onStack = (id, re) => {
  for (let at = id; at !== undefined; at = parent.get(at)) if (re.test(byId.get(at).callFrame.functionName)) return true;
  return false;
};
const self = new Map(),
  buckets = new Map();
let total = 0;
for (const [id, t] of time) {
  total += t;
  const { functionName: fn, url, lineNumber } = byId.get(id).callFrame,
    file = url.split("/").pop();
  const key = `${fn || "(anon)"} ${file}:${lineNumber}`;
  self.set(key, (self.get(key) ?? 0) + t);
  const bucket = /garbage/.test(fn)
    ? "gc"
    : /server-derived|derived-/.test(file)
      ? "derived record / tail"
      : /^(utf8Write|writeBytes|createUnsafeBuffer)$/.test(fn)
        ? "output encode / write"
        : /escape/.test(file) || /RegExp/.test(fn)
          ? "escape"
          : /^(server|template|server-spread|server-rows)-/.test(file)
            ? "record walk (runtime)"
            : file === "entry.server.js" && onStack(id, /^(Root|App|Layout)$/)
              ? "component functions (app)"
              : /^(decode|decodeUTF8|readAllBytes|concat)$/.test(fn)
                ? "harness body read"
                : "other";
  buckets.set(bucket, (buckets.get(bucket) ?? 0) + t);
}
const pct = (v) => ((100 * v) / total).toFixed(1).padStart(5) + "%";
console.log("total ms", (total / 1000).toFixed(0));
for (const [k, v] of [...buckets].sort((a, b) => b[1] - a[1])) console.log(pct(v), "[" + k + "]");
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(pct(v), k);
