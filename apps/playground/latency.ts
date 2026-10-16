// Document latency of the production playground: first request after a fresh start and warm
// percentiles per route, over loopback with Brotli negotiated like a browser. Fails when a warm p50
// exceeds the budget (LATENCY_BUDGET_MS, default 1 ms). Requires `node build.ts` first.
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";

const ROUTES = ["/", "/resume", "/items/1"];
const WARMUP = 100, SAMPLES = 1000, STARTS = 3;
const budget = Number(process.env.LATENCY_BUDGET_MS ?? 1);
const port = Number(process.env.LATENCY_PORT ?? 4198);
const serve = fileURLToPath(new URL("./dist/serve.mjs", import.meta.url));
const headers = { accept: "text/html", "accept-encoding": "br, gzip" };

const ready = () =>
  new Promise<void>((done) => {
    const attempt = () => {
      const socket = createConnection(port, "127.0.0.1", () => (socket.destroy(), done()));
      socket.on("error", () => setTimeout(attempt, 20));
    };
    attempt();
  });
async function time(url: string): Promise<number> {
  const start = performance.now();
  const response = await fetch(url, { headers });
  await response.arrayBuffer();
  if (response.status !== 200) throw new Error(`${url} returned ${response.status}`);
  return performance.now() - start;
}
async function withServer<T>(run: (origin: string) => Promise<T>): Promise<T> {
  const child = spawn(process.execPath, [serve], { env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" }, stdio: "ignore" });
  try {
    await ready();
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    child.kill();
    await new Promise((done) => child.once("exit", done));
  }
}

// Warm the client's own fetch machinery first, so the first-request number is the server's.
await withServer((origin) => time(origin + "/healthz"));
const rows: { route: string; first: number; p50: number; p90: number; p99: number }[] = [];
for (const route of ROUTES) {
  const firsts: number[] = [];
  for (let i = 0; i < STARTS; i++) firsts.push(await withServer((origin) => time(origin + "/healthz").then(() => time(origin + route))));
  const warm = await withServer(async (origin) => {
    for (let i = 0; i < WARMUP; i++) await time(origin + route);
    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) samples.push(await time(origin + route));
    return samples.sort((a, b) => a - b);
  });
  const at = (q: number) => warm[Math.floor(q * (warm.length - 1))]!;
  rows.push({ route, first: firsts.sort((a, b) => a - b)[Math.floor(STARTS / 2)]!, p50: at(0.5), p90: at(0.9), p99: at(0.99) });
}
const ms = (value: number) => value.toFixed(2).padStart(7);
console.log("route        first     p50     p90     p99  (ms)");
for (const row of rows) console.log(`${row.route.padEnd(10)} ${ms(row.first)} ${ms(row.p50)} ${ms(row.p90)} ${ms(row.p99)}`);
const over = rows.filter((row) => row.p50 > budget);
if (over.length) {
  console.error(`Warm p50 over ${budget} ms: ${over.map((row) => row.route).join(", ")}`);
  process.exitCode = 1;
}
