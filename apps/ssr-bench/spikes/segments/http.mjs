// Lane ZERO SEGMENTS: HTTP lanes through the real node adapter, interleaved (a fresh `srv.mjs` process per lane and round),
// keep-alive load per path; server CPU µs / request from the server process itself (portable: no /proc), p50 / p99 / TTFB,
// RSS high-water mark. PATHS = comma list (`R` = rows). usage: node http.mjs <root> <secs> <rounds> <conc> <rows,…> <name=dist>…
import http from "node:http";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const [root, secs, rounds, conc, rowsArg, ...laneArgs] = process.argv.slice(2);
const lanes = laneArgs.map((a) => a.split("="));
const here = new URL(".", import.meta.url).pathname;
const paths = (rows) => (process.env.PATHS ?? "/resume?rows=R&token=t1").split(",").map((p) => p.replace("R", rows));
const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const out = {};
let port = 4460;
for (let r = 0; r < +rounds; r++)
  for (const [name, dist] of lanes) {
    const p = port++;
    const child = spawn(process.execPath, ["--max-semi-space-size=8", here + "srv.mjs", root, resolve(root, dist), String(p)], {
      stdio: ["pipe", "pipe", "inherit"],
    });
    let buf = "",
      waiters = [];
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        waiters.shift()?.(line);
      }
    });
    const next = () => new Promise((res) => waiters.push(res));
    await next(); // LISTENING
    const stat = async () => {
      child.stdin.write("cpu\n");
      return JSON.parse(await next());
    };
    const agent = new http.Agent({ keepAlive: true, maxSockets: +conc });
    const get = (url) =>
      new Promise((res, rej) => {
        const t0 = process.hrtime.bigint();
        let ttfb = 0,
          n = 0;
        http
          .get(url, { agent }, (rs) => {
            rs.once("data", () => (ttfb = Number(process.hrtime.bigint() - t0) / 1e6));
            rs.on("data", (c) => (n += c.length));
            rs.on("end", () => res([n, ttfb, Number(process.hrtime.bigint() - t0) / 1e6]));
          })
          .on("error", rej);
      });
    for (const rows of rowsArg.split(",").map(Number))
      for (const path of paths(rows)) {
        const url = `http://127.0.0.1:${p}${path}`;
        for (let i = 0; i < 200; i++) await get(url);
        const lat = [],
          ttf = [];
        let count = 0;
        const s0 = await stat();
        const end = Date.now() + +secs * 1000;
        await Promise.all(
          Array.from({ length: +conc }, async () => {
            while (Date.now() < end) {
              const [, t, l] = await get(url);
              count++;
              lat.push(l);
              ttf.push(t);
            }
          }),
        );
        const s1 = await stat();
        lat.sort((a, b) => a - b);
        ttf.sort((a, b) => a - b);
        const k = `${path.split("?")[0]}:${rows}|${name}`;
        (out[k] ??= []).push({
          cpu: (s1.cpu - s0.cpu) / count,
          p50: lat[lat.length >> 1],
          p99: lat[Math.floor(lat.length * 0.99)],
          ttfb: ttf[ttf.length >> 1],
          hwm: s1.hwm / 2 ** 20,
          rps: count / +secs,
        });
      }
    child.kill();
    agent.destroy();
  }
for (const [k, v] of Object.entries(out)) {
  const m = (f) => +med(v.map((x) => x[f])).toFixed(f === "cpu" || f === "rps" ? 0 : 3);
  console.log(
    JSON.stringify({
      case: k,
      cpuUs: m("cpu"),
      p50: m("p50"),
      p99: m("p99"),
      ttfb: m("ttfb"),
      hwmMiB: +Math.max(...v.map((x) => x.hwm)).toFixed(0),
      rps: m("rps"),
      n: v.length,
    }),
  );
}
process.exit(0);
