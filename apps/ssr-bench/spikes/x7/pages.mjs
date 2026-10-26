// Lane X7: in-process page server CPU over a built router app (`loadBuild(dist).handler`, body drained as text).
//   node pages.mjs <repo> <dist> cpu <iters> <path>...        best-of-5 µs / req, KB allocated / req, body bytes
//   node pages.mjs <repo> <dist> all <out.json>               every prerendered page (index.html under client/): min CPU of 3 passes
//   node pages.mjs <repo> <dist> shas <out.json>              sha1 per page body (asset hashes + nonces normalised)
//   node pages.mjs - <a.json> <b.json>                        compare two shas / all files
// LOOP=<ms> after `cpu`: loop the first path (for `node --cpu-prof`).
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import v8 from "node:v8";

const [repo, dist, mode, ...rest] = process.argv.slice(2);
if (repo === "-") {
  const a = JSON.parse(readFileSync(dist, "utf8")),
    b = JSON.parse(readFileSync(mode, "utf8"));
  const keys = Object.keys(a);
  if (typeof a[keys[0]] === "number") {
    const sum = (o) => Object.values(o).reduce((x, y) => x + y, 0);
    console.log("pages", keys.length, "sum ms", (sum(a) / 1000).toFixed(1), "→", (sum(b) / 1000).toFixed(1));
    for (const [k, x, y] of keys
      .map((k) => [k, a[k], b[k]])
      .sort((p, q) => q[1] / q[2] - p[1] / p[2])
      .slice(0, 10))
      console.log(k.padEnd(56), x.toFixed(0), "→", y.toFixed(0), (x / y).toFixed(2) + "×");
  } else {
    const diff = keys.filter((k) => a[k] !== b[k]);
    console.log("pages", keys.length, "differ", diff.length);
    for (const k of diff.slice(0, 20)) console.log(k, a[k], "→", b[k]);
  }
  process.exit(0);
}
const { loadBuild } = await import(pathToFileURL(resolve(repo, "libs/router/adapters/build.ts")).href);
const build = await loadBuild(resolve(dist));
const get = async (path) => (await build.handler(new Request("http://localhost" + path))).text();
const HASHED = /(\/assets\/[\w.-]+?)-[\w-]{8}\.(js|css)/g;
const normal = (html) => html.replace(HASHED, "$1.$2").replace(/nonce="[^"]*"/g, "");
function pages() {
  const client = join(resolve(dist), "client"),
    out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (!/^(assets|_rivet|pagefind)$/.test(name)) walk(path);
      } else if (name === "index.html") out.push(dir === client ? "/" : "/" + relative(client, dir) + "/");
    }
  };
  walk(client);
  return out.sort();
}
if (mode === "cpu") {
  const iters = +rest[0];
  for (const path of rest.slice(1)) {
    let html = "";
    for (let i = 0; i < Math.max(20, iters / 4); i++) html = await get(path);
    let cpu = Infinity,
      alloc = Infinity;
    for (let r = 0; r < 5; r++) {
      const a0 = v8.getHeapStatistics().total_allocated_bytes,
        c0 = process.cpuUsage();
      for (let i = 0; i < iters; i++) html = await get(path);
      const c = process.cpuUsage(c0);
      cpu = Math.min(cpu, (c.user + c.system) / iters);
      alloc = Math.min(alloc, (v8.getHeapStatistics().total_allocated_bytes - a0) / iters / 1024);
    }
    const sha = createHash("sha1").update(normal(html)).digest("hex").slice(0, 10);
    console.log(path.padEnd(56), cpu.toFixed(0).padStart(6), "µs", alloc.toFixed(0).padStart(6), "KB", String(html.length).padStart(8), "B", sha);
  }
  if (process.env.LOOP) for (const t = Date.now(); Date.now() - t < +process.env.LOOP;) await get(rest[1]);
} else if (mode === "all") {
  const list = pages(),
    best = {};
  for (let pass = 0; pass < 4; pass++)
    for (const path of list) {
      const c0 = process.cpuUsage();
      for (let i = 0; i < 3; i++) await get(path);
      const c = process.cpuUsage(c0);
      if (pass) best[path] = Math.min(best[path] ?? Infinity, (c.user + c.system) / 3);
    }
  writeFileSync(rest[0], JSON.stringify(best));
  console.log("pages", list.length, "sum ms", (Object.values(best).reduce((x, y) => x + y, 0) / 1000).toFixed(1));
} else if (mode === "shas") {
  const out = {};
  for (const path of pages()) {
    const response = await build.handler(new Request("http://localhost" + path));
    const body = normal(await response.text());
    out[path] = response.status + " " + body.length + " " + createHash("sha1").update(body).digest("hex").slice(0, 12);
  }
  writeFileSync(rest[0], JSON.stringify(out, null, 1));
  console.log("pages", Object.keys(out).length);
}
