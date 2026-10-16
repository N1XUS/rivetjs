// Child script for `cluster.test.ts`: the cluster primary / workers of `adapters/cluster.ts` over `serve()` + a
// route-cached page. Primary: prints `URL <url>`, closes on `close` from stdin (prints `CLOSED`). Workers: `/a`
// (stored page with the worker's pid), `/rv` (revalidate /a here and, relayed, in the others), `/pid`, `/crash`.
// `CLUSTER_MODE=fail-start`: workers exit before listening (primary prints `REJECTED`, then `FORKS <n>` a second
// later); `give-up`: workers exit right after listening (the primary gives up and exits 1).
import cluster from "node:cluster";
import { isPrimary, primary, worker } from "../adapters/cluster.ts";
import { serve } from "../adapters/node.ts";
import { revalidate, withRouteRules } from "../server/route-cache.ts";

const mode = process.env.CLUSTER_MODE;
if (isPrimary() && mode === "fail-start") {
  let forks = 0;
  cluster.on("fork", () => forks++);
  await primary(2, 1000, (error) => console.error(String(error))).catch((error) => console.log(`REJECTED ${String(error)}`));
  setTimeout(() => (console.log(`FORKS ${forks}`), process.exit(0)), 1000);
} else if (isPrimary() && mode === "give-up") {
  await primary(2, 1000, (error) => console.error(String(error)));
  console.log("STARTED");
} else if (isPrimary()) {
  const serving = await primary(2, 1000, (error) => console.error(String(error)));
  console.log(`URL ${serving.url} ${serving.workers}`);
  process.stdin.on("data", async (data) => {
    if (String(data).includes("close")) {
      await serving.close();
      console.log("CLOSED");
      process.exit(0);
    }
  });
} else if (mode === "fail-start") {
  process.exit(4);
} else {
  if (mode === "give-up") setTimeout(() => process.exit(5), 300);
  let renders = 0;
  const page = async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path === "/crash") process.exit(3);
    if (path === "/rv") return new Response(String(revalidate({ path: "/a" })));
    if (path === "/pid") return new Response(String(process.pid));
    return new Response(`<p>${process.pid} ${++renders}</p>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
  };
  const handler = withRouteRules(page, { "/a": { swr: 60 } }, { policy: () => false, hash: null }, "", { origin: "http://127.0.0.1" });
  await worker(() => serve({ handler, port: 0, origin: "http://127.0.0.1", grace: 500 }));
}
