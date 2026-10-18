// M1 T1 (docs/design/plans/2026-10-18-derived-client.md): request / bytes probe over built docs example frames.
// For each frame: JS requests / bytes / evaluated before input (3 s idle after load), then an optional first click
// (`--click` selector, per frame `id=selector`) with the requests it adds and its latency to the first DOM change.
// Runs under the resume-bench `slow` profile (Slow 4G + 4× CPU) unless `--fast`. Serve the built site first.
//
//   RESUME_BENCH_CHROME=/opt/pw-browsers/chromium node apps/resume-bench/spikes/frames-probe.ts \
//     --url http://127.0.0.1:4327 --frames select-default,date-picker-basic,combo-box-default,showcase-dashboard \
//     --click 'select-default=[data-slot=select-trigger],date-picker-basic=button[data-slot=date-picker-button],combo-box-default=button,showcase-dashboard=#period >> text=7 days' \
//     [--repeats 3] [--fast] [--label component]
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const opt = (name: string, def: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1]! : def);
const base = opt("--url", "http://127.0.0.1:4327");
const frames = opt("--frames", "showcase-dashboard").split(",");
const repeats = Number(opt("--repeats", "3"));
const slow = !argv.includes("--fast");
const label = opt("--label", "");
const clicks = Object.fromEntries(
  opt("--click", "")
    .split(",")
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      return [pair.slice(0, i), pair.slice(i + 1)];
    }),
) as Record<string, string>;

const browser = await chromium.launch({
  ...(process.env.RESUME_BENCH_CHROME ? { executablePath: process.env.RESUME_BENCH_CHROME } : { channel: "chrome" }),
  args: ["--use-mock-keychain", "--password-store=basic"],
});
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};

interface Sample {
  requestsBefore: number;
  bytesBefore: number;
  evaluatedBefore: number;
  clickRequests: number;
  clickBytes: number;
  clickLatency: number;
}

async function probe(frame: string): Promise<Sample> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (slow) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const js: { url: string; bytes: number }[] = [];
  page.on("response", async (r) => {
    try {
      if (r.request().resourceType() === "script") js.push({ url: r.url(), bytes: Number(r.headers()["content-length"] ?? 0) || (await r.body()).length });
    } catch {}
  });
  await page.addInitScript(() => {
    (window as unknown as { __m1: Record<string, number> }).__m1 = {};
    addEventListener("click", (e) => ((window as unknown as { __m1: Record<string, number> }).__m1.click = e.timeStamp), true);
  });
  await page.goto(`${base}/examples/${frame}/frame/`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const requestsBefore = js.length;
  const bytesBefore = js.reduce((n, j) => n + j.bytes, 0);
  const evaluatedBefore = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => /\.js(\?|$)/.test(e.name)).length);
  let clickRequests = 0;
  let clickBytes = 0;
  let clickLatency = NaN;
  const selector = clicks[frame];
  if (selector) {
    const before = js.length;
    const changed = page.evaluate(
      () =>
        new Promise<number>((done) => {
          const mo = new MutationObserver(() => {
            mo.disconnect();
            done(performance.now());
          });
          mo.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
        }),
    );
    await page.click(selector);
    const at = await Promise.race([changed, page.waitForTimeout(20000).then(() => NaN)]);
    const mark = await page.evaluate(() => (window as unknown as { __m1: Record<string, number> }).__m1.click);
    await page.waitForTimeout(1500);
    clickRequests = js.length - before;
    clickBytes = js.slice(before).reduce((n, j) => n + j.bytes, 0);
    clickLatency = at - mark;
  }
  await context.close();
  return { requestsBefore, bytesBefore, evaluatedBefore, clickRequests, clickBytes, clickLatency };
}

console.log(`${label ? label + " — " : ""}${slow ? "slow (Slow 4G + 4× CPU)" : "fast"}, ${repeats} repeats, medians`);
console.log(`| frame | JS requests before input | KB before | evaluated before | click: +requests | +KB | click → DOM change ms |`);
console.log(`| --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
for (const frame of frames) {
  const samples: Sample[] = [];
  for (let i = 0; i < repeats; i++) {
    try {
      samples.push(await probe(frame));
    } catch (e) {
      console.error(`${frame} repeat ${i}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  const m = (k: keyof Sample) => median(samples.map((s) => s[k]).filter(Number.isFinite));
  console.log(
    `| ${frame} | ${m("requestsBefore")} | ${(m("bytesBefore") / 1024).toFixed(1)} | ${m("evaluatedBefore")} | ${clicks[frame] ? m("clickRequests") : "–"} | ${clicks[frame] ? (m("clickBytes") / 1024).toFixed(1) : "–"} | ${clicks[frame] ? m("clickLatency").toFixed(0) : "–"} |`,
  );
}
await browser.close();
