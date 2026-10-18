// Spike X1 browser half: does the browser decode each scheme byte-exactly? Starts the spike server in-process,
// fetches every shape × scheme in Chromium (and Firefox / WebKit when installed) and compares the decoded text with
// the identity response; also reads the transfer size from Resource Timing.
//
//   node apps/ssr-bench/spikes/splice/browser.ts [--port 8788] [--browsers chromium,firefox,webkit]
import { chromium, firefox, webkit, type BrowserType } from "playwright";
import { serve } from "./splice.ts";

const argv = process.argv;
const opt = (name: string, def: string) => (argv.indexOf(name) > 0 ? argv[argv.indexOf(name) + 1] : def);
const port = Number(opt("--port", "8788"));
const want = opt("--browsers", "chromium").split(",");
const engines: Record<string, BrowserType> = { chromium, firefox, webkit };

const server = serve(port);
const base = `http://127.0.0.1:${port}`;
const index = (await (await fetch(`${base}/index`)).json()) as {
  shapes: { i: number; name: string }[];
  schemes: { i: number; name: string; encoding: string }[];
};

console.log(`| browser | shape | scheme | decoded == identity | transfer bytes |`);
console.log(`| --- | --- | --- | --- | ---: |`);
for (const name of want) {
  let browser;
  try {
    // the container's Chromium is pinned at /opt/pw-browsers/chromium (another Playwright build id than the repo's)
    browser = await engines[name].launch(name === "chromium" && process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  } catch (e) {
    console.log(`| ${name} | – | – | not available: ${(e as Error).message.split("\n")[0].slice(0, 60)} | – |`);
    continue;
  }
  const page = await browser.newPage();
  await page.goto(`${base}/0/0`);
  for (const shape of index.shapes) {
    const truth = (await page.evaluate(async (u) => (await fetch(u)).text(), `${base}/${shape.i}/0`)) as string;
    for (const s of index.schemes) {
      if (s.i === 0) continue;
      const url = `${base}/${shape.i}/${s.i}`;
      const result = (await page.evaluate(async (u) => {
        try {
          const r = await fetch(u);
          const t = await r.text();
          const e = performance.getEntriesByName(u).pop() as PerformanceResourceTiming | undefined;
          return { t, ok: r.ok, transfer: e?.encodedBodySize ?? -1 };
        } catch (err) {
          return { t: "", ok: false, transfer: -1, err: String(err) };
        }
      }, url)) as { t: string; ok: boolean; transfer: number; err?: string };
      const same = result.ok && result.t === truth;
      console.log(
        `| ${name} | ${shape.name} | ${s.name} | ${same ? "yes" : `NO${result.err ? ` (${result.err.slice(0, 50)})` : result.ok ? ` (decoded ${result.t.length} chars vs ${truth.length})` : " (fetch failed)"}`} | ${result.transfer} |`,
      );
    }
  }
  await browser.close();
}
server.close();
