// Screenshot parity of built pages under a stylesheet swap (render-cost A/B: no visual diff allowed).
// Usage: node apps/dom-bench/render/parity.ts --root <dist> --dirs /components/,/docs/ [--pages /a/,/b/]
//   --swap /assets/x.css=<file> [--targets ".prose > .example"] [--per 4] [--width 1280 --height 900]
// Per page: viewport at top, then each sampled target scrolled into view (block: center), plus the final
// document height after visiting them; lane A = served files, lane B = swapped stylesheet. Exact PNG equality;
// differing shots are written to --out for inspection. Animations disabled (Playwright `animations: "disabled"`).
import { chromium, type BrowserContext } from "playwright";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { AddressInfo } from "node:net";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1]!;
};
const root = resolve(option("root", "apps/ui-docs/dist/client"));
const swaps = new Map(
  option("swap", "")
    .split(",")
    .filter(Boolean)
    .map((x) => x.split("=") as [string, string]),
);
const targets = option("targets", ".prose > .example, .prose > .code-block, .prose > .table-wrap");
const per = Number(option("per", "4"));
const out = resolve(option("out", ".artifacts/render-parity"));
const width = Number(option("width", "1280"));
const height = Number(option("height", "900"));
const scheme = option("scheme", "light") as "light" | "dark";
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
};
const server = createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url!, "http://localhost").pathname);
    let file = resolve(root, "." + path);
    if (existsSync(file) && (await stat(file)).isDirectory()) file = resolve(file, "index.html");
    else if (!existsSync(file) && existsSync(file + ".html")) file += ".html";
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise<void>((yes) => server.listen(0, "127.0.0.1", yes));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
let pages = option("pages", "").split(",").filter(Boolean);
for (const dir of option("dirs", "").split(",").filter(Boolean))
  for (const d of (await readdir(resolve(root, "." + dir))).sort()) if (existsSync(resolve(root, "." + dir, d, "index.html"))) pages.push(`${dir}${d}/`);
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ executablePath: existsSync(chrome) ? chrome : undefined });
const lane = async (swap: boolean) => {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: "reduce" });
  if (swap)
    for (const [path, file] of swaps)
      await context.route(origin + path, async (route) => route.fulfill({ status: 200, contentType: "text/css", body: await readFile(resolve(file)) }));
  return context;
};
const shoot = async (context: BrowserContext, path: string) => {
  const page = await context.newPage();
  const shots: Buffer[] = [];
  try {
    await page.goto(origin + path, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    shots.push(await page.screenshot({ animations: "disabled", caret: "hide" }));
    const n = await page.evaluate((sel) => document.querySelectorAll(sel).length, targets);
    const picks = n <= per ? [...Array(n).keys()] : [...new Set(Array.from({ length: per }, (_, i) => Math.round((i * (n - 1)) / (per - 1))))];
    for (const k of picks) {
      await page.evaluate(([sel, k]) => (document.querySelectorAll(sel as string)[k as number] as HTMLElement).scrollIntoView({ block: "center" }), [
        targets,
        k,
      ] as const);
      await page.waitForTimeout(120);
      shots.push(await page.screenshot({ animations: "disabled", caret: "hide" }));
    }
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    return { shots, h };
  } finally {
    await page.close();
  }
};
const a = await lane(false);
const b = await lane(true);
let diffs = 0;
let shots = 0;
await mkdir(out, { recursive: true });
for (const path of pages) {
  const [x, y] = [await shoot(a, path), await shoot(b, path)];
  const bad: number[] = [];
  for (let i = 0; i < Math.max(x.shots.length, y.shots.length); i++) {
    shots++;
    if (!x.shots[i] || !y.shots[i] || Buffer.compare(x.shots[i]!, y.shots[i]!) !== 0) {
      bad.push(i);
      const slug = path.replace(/\W+/g, "_");
      if (x.shots[i]) await writeFile(resolve(out, `${slug}${i}-a.png`), x.shots[i]!);
      if (y.shots[i]) await writeFile(resolve(out, `${slug}${i}-b.png`), y.shots[i]!);
    }
  }
  diffs += bad.length;
  console.log(`${path.padEnd(40)} shots ${x.shots.length} ${bad.length ? "DIFF " + bad.join(",") : "same"}${x.h !== y.h ? ` height ${x.h} vs ${y.h}` : ""}`);
}
console.log(`pages ${pages.length} shots ${shots} diffs ${diffs}`);
await browser.close();
server.close();
process.exitCode = diffs ? 1 : 0;
