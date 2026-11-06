// Removal cost on the server's 1,000-row list (lane FILTER3 2026-11-06): per variant a fresh page of a built lane dist with its
// scripts blocked (server DOM only), 4x CPU, the 900 non-"golf" rows removed in one task → JS ms + the forced layout after.
// node apps/resume-bench/spikes/remove-cost.ts <dist> [reps=8] [variants, comma-separated]
// Variants: li-removeChild (the drop pass today: markers stay), li-remove, all-removeChild (markers too), range-runs
// (`Range.deleteContents` per run of dropped rows), li-removeChild-noMark (comments removed first), -markEnd (comments moved
// to the end), -text (comments replaced by empty text nodes).
import { chromium } from "playwright";
import { resolve } from "node:path";
import { serve } from "../serve.ts";
import { chromeTarget } from "../../../scripts/bench/shared.ts";
const dist = process.argv[2],
  reps = Number(process.argv[3] ?? 8);
const variants = (
  process.argv[4] ?? "li-removeChild,li-remove,all-removeChild,range-runs,li-removeChild-noMark,li-removeChild-markEnd,li-removeChild-text"
).split(",");
const browser = await chromium.launch({ ...chromeTarget(), headless: true });
const server = await serve(resolve(dist));
const res: Record<string, number[]> = {};
for (let r = 0; r < reps; r++)
  for (const v of variants) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route("**/*.js", (route) => route.abort());
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.goto(server.url);
    await page.waitForTimeout(300);
    const t = await page.evaluate((v) => {
      const ul = document.getElementById("rows")!;
      if (v === "li-removeChild-noMark") for (const n of [...ul.childNodes]) if (n.nodeType === 8) ul.removeChild(n);
      if (v === "li-removeChild-markEnd") for (const n of [...ul.childNodes]) if (n.nodeType === 8) ul.appendChild(n);
      if (v === "li-removeChild-text") for (const n of [...ul.childNodes]) if (n.nodeType === 8) ul.replaceChild(document.createTextNode(""), n);
      const lis = [...ul.querySelectorAll("li")];
      const drop = lis.filter((li) => !li.textContent!.includes("golf"));
      document.body.offsetHeight;
      const t0 = performance.now();
      if (v.startsWith("li-removeChild")) for (const li of drop) ul.removeChild(li);
      else if (v === "li-remove") for (const li of drop) li.remove();
      else if (v === "all-removeChild") for (const li of drop) (ul.removeChild(li.previousSibling!), ul.removeChild(li.nextSibling!), ul.removeChild(li));
      else {
        const range = document.createRange();
        let i = 0;
        while (i < drop.length) {
          let j = i;
          while (j + 1 < drop.length && drop[j].nextSibling!.nextSibling!.nextSibling === drop[j + 1]) j++;
          range.setStartBefore(drop[i].previousSibling!);
          range.setEndAfter(drop[j].nextSibling!);
          range.deleteContents();
          i = j + 1;
        }
      }
      const t1 = performance.now();
      document.body.offsetHeight;
      return [t1 - t0, performance.now() - t1];
    }, v);
    (res[v + " js"] ??= []).push(t[0]);
    (res[v + " layout"] ??= []).push(t[1]);
    await context.close();
  }
await server.close();
await browser.close();
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1];
for (const [k, a] of Object.entries(res)) console.log(k.padEnd(32), med(a).toFixed(2), a.map((x) => x.toFixed(1)).join(" "));
