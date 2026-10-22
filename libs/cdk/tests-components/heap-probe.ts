// Server memory probe (VIRT-LEAK 2026-10-21; runtime CLAUDE.md "Server memory"): render cdk story routes in-process through
// a production build's request handler and report the heap retained per render (MB, after `gc()`, renders back to back
// with no timer phase between them — the shape that exposed the selector fold timer holding whole renders).
//
//   node --expose-gc libs/cdk/tests-components/heap-probe.ts [--dist <dir>] [--build] [--routes /a,/b|all] [--n 20]
//        [--yield] [--recorded]
//
// --dist: story build (default `app/$STORIES_DIST` or `app/dist`); --build: build it first (`app/serve.ts`).
// --routes: default every route of `app/src/routes/`. --yield: a 2 ms timer between renders (what a server's event loop
// gives). Lazy rows are the default (LAZY-FLIP 2026-10-22); --recorded: `RIVET_LAZY_ROWS=off` (the server records the rows).
import { readdirSync } from "node:fs";
import { loadavg } from "node:os";
import { fileURLToPath } from "node:url";
import { loadBuild } from "../../router/adapters/build.ts";

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1]! : d;
};
const flag = (name: string) => process.argv.includes("--" + name);
const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error("heap-probe: run under node --expose-gc");
const appDir = fileURLToPath(new URL("./app/", import.meta.url));
if (flag("build")) {
  if (flag("dist")) process.env.STORIES_DIST ??= arg("dist", "");
  await (await import("./app/serve.ts")).buildApp();
}
const dist = flag("dist") ? arg("dist", "") : appDir + (process.env.STORIES_DIST ?? "dist");
if (flag("recorded")) process.env.RIVET_LAZY_ROWS = "off";
const { handler } = await loadBuild(dist);
const routesArg = arg("routes", "all");
const routes =
  routesArg === "all"
    ? readdirSync(appDir + "src/routes")
        .filter((file) => file.endsWith(".tsx") && !file.startsWith("_"))
        .map((file) => "/" + file.replace(/\.tsx$/, "").replace(/^index$/, ""))
    : routesArg.split(",");
const n = Number(arg("n", "20"));
const pause = flag("yield");
const used = (): number => {
  gc();
  gc();
  return process.memoryUsage().heapUsed;
};
const load = () =>
  loadavg()
    .map((x) => x.toFixed(1))
    .join(" ");
console.log(`dist ${dist} · ${n} renders · ${pause ? "yield" : "no yield"} · load ${load()}`);
console.log("| route | status | MB / render | ms / render | heap MB |");
console.log("| --- | --- | ---: | ---: | ---: |");
for (const route of routes) {
  let status = 0;
  const once = async () => {
    const response = await handler(new Request("http://localhost" + route));
    await response.text();
    status = response.status;
    if (pause) await new Promise((done) => setTimeout(done, 2));
  };
  for (let i = 0; i < 5; i++) await once();
  const before = used(),
    t0 = performance.now();
  for (let i = 0; i < n; i++) await once();
  const t = (performance.now() - t0) / n,
    after = used();
  console.log(`| ${route} | ${status} | ${((after - before) / n / 1e6).toFixed(3)} | ${t.toFixed(1)} | ${(after / 1e6).toFixed(0)} |`);
}
console.log(`load after ${load()}`);
process.exit(0);
