// Lane ZERO SEGMENTS: interleaved in-process handler A/B (`loadBuild(dist).handler`, body drained), CPU µs / request,
// median of rounds. usage: node ab.mjs <root> <path,…> <n> <rounds> <name=dist>…
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
const [root, pathsArg, nArg, roundsArg, ...lanes] = process.argv.slice(2);
const here = process.cwd();
process.chdir(root);
const { loadBuild } = await import(pathToFileURL(join(root, "libs/router/adapters/build.ts")).href);
const builds = [];
for (const l of lanes) {
  const [name, dist] = l.split("=");
  builds.push([name, await loadBuild(resolve(root, dist))]);
}
process.chdir(here);
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
for (const path of pathsArg.split(",")) {
  const rows = +(/rows=(\d+)/.exec(path)?.[1] ?? 100);
  const n = Math.max(10, Math.round(+nArg * (100 / Math.max(rows, 100)) ** 0.8));
  const res = {};
  const run = (b) => b.handler(new Request("http://localhost" + path)).then((r) => r.arrayBuffer());
  for (const [, b] of builds) for (let i = 0; i < 100; i++) await run(b);
  for (let k = 0; k < +roundsArg; k++)
    for (const [name, b] of builds) {
      const c0 = process.cpuUsage();
      for (let i = 0; i < n; i++) await run(b);
      const c = process.cpuUsage(c0);
      (res[name] ??= []).push((c.user + c.system) / n);
    }
  console.log(
    path.padEnd(36),
    Object.entries(res)
      .map(([k, v]) => `${k}=${med(v).toFixed(1)}`)
      .join("  "),
  );
}
