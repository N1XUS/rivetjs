// Lane ZERO SEGMENTS: production node adapter (`@rivetjs/router/node` start) over a built app; each stdin line prints the
// process CPU µs (user + system) and RSS high-water mark as one JSON line ("exit" ends it). usage: node srv.mjs <root> <dist> <port>
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
const [root, dist, port] = process.argv.slice(2);
process.chdir(root);
const { start } = await import(pathToFileURL(join(root, "libs/router/adapters/node.ts")).href);
const s = await start({ dist: resolve(root, dist), port: +port, host: "127.0.0.1" });
let hwm = 0;
setInterval(() => (hwm = Math.max(hwm, process.memoryUsage.rss())), 20).unref();
createInterface({ input: process.stdin }).on("line", (l) => {
  if (l === "exit") process.exit(0);
  const c = process.cpuUsage();
  hwm = Math.max(hwm, process.memoryUsage.rss());
  process.stdout.write(JSON.stringify({ cpu: c.user + c.system, rss: process.memoryUsage.rss(), hwm }) + "\n");
});
console.log("LISTENING " + s.url);
