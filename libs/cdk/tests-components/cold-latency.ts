// Cold first-interaction latency on resumed cdk story pages (production build, node adapter, headless Chromium).
// Measures, per target × scenario × network condition: first input → DOM condition → next paint (p50 over repeats),
// JS fetched before the input, total JS, timeouts (input lost). `slow` = 150 ms RTT, 1.6 Mbps down / 750 kbps up,
// 4x CPU (CDP Network.emulateNetworkConditions + Emulation.setCPUThrottlingRate), cache disabled.
//
//   node libs/cdk/tests-components/cold-latency.ts [--dist <dir>] [--build] [--repeats 3] [--conditions fast,slow]
//        [--targets sidebar,carousel,scroll-area] [--scenarios click,hoverClick] [--wait <ms>] [--trace] [--lean] [--app cdk|ui]
//
// --app ui: the @rivetjs/ui story app (`libs/ui/tests-components/app`, targets `ui-*`); default cdk.
// --dist: story build (default `app/$STORIES_DIST` or `app/dist`); --build: build it first (`app/serve.ts`).
// --wait: settle time after load before the input (default 2500 fast / 6000 slow: idle / visible preloads done).
// --trace: print every script request that finished after the input (url, ms after input, bytes).
// --lean: disable router fetch-ahead; default keeps the production preload plan (bytes may already be downloaded).
// Scenarios a target does not list are skipped. Run under the bench lock when numbers are compared across lanes.
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { start } from "@rivetjs/router/node";

const arg = (name: string, d: string) => {
  const i = process.argv.indexOf("--" + name);
  return i > 0 ? process.argv[i + 1]! : d;
};
const flag = (name: string) => process.argv.includes("--" + name);

interface Target {
  path: string;
  /** Element the input goes to. */
  sel: string;
  /** Page-side predicate (expression) that is true once the input was applied. */
  until: string;
  /** `drag` scenario: element dragged 190 px towards the start (pointer down → move → up). */
  drag?: string;
  scenarios: string[];
  /** Story app (default cdk). */
  app?: "ui";
}

// Select popover open: the listbox is rendered and the trigger reports `aria-expanded`.
const listboxOpen = (trigger: string) =>
  `document.querySelector(${JSON.stringify(trigger)})?.getAttribute("aria-expanded") === "true" && !!document.querySelector('[role="listbox"]')`;

const TARGETS: Record<string, Target> = {
  "scheduler-more": {
    path: "/scheduler",
    sel: '#agenda [data-rv-day-index="8"] .rv-SchedulerMonth-more',
    until: `document.getElementById("more-count")?.textContent === "1" && !!document.querySelector(".rv-SchedulerMonth-popover")`,
    scenarios: ["click", "hoverClick", "keyClick", "tapClick"],
  },
  sidebar: {
    path: "/sidebar",
    sel: "#inbox",
    until: `document.getElementById("pressed")?.textContent === "1"`,
    scenarios: ["click", "hoverClick", "keyClick", "tapClick"],
  },
  "sidebar-trigger": {
    path: "/sidebar",
    sel: "#trigger",
    until: `document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state") === "collapsed"`,
    scenarios: ["click", "hoverClick", "keyClick", "tapClick"],
  },
  carousel: {
    path: "/carousel",
    sel: "#basic-next",
    until: `document.getElementById("basic-selected")?.textContent === "2"`,
    drag: "#basic .rv-CarouselViewport",
    scenarios: ["click", "hoverClick", "keyClick", "tapClick", "drag"],
  },
  "ui-select": {
    app: "ui",
    path: "/select-cold",
    sel: "#sc-trigger",
    until: listboxOpen("#sc-trigger"),
    scenarios: ["click", "hoverClick", "keyClick", "tapClick"],
  },
  "ui-cell-select": {
    app: "ui",
    path: "/cell-select-cold",
    sel: "#csc button",
    until: listboxOpen("#csc button"),
    scenarios: ["click", "hoverClick", "keyClick", "tapClick"],
  },
  "ui-inline-select": {
    app: "ui",
    path: "/inline-select-cold",
    sel: "#isc button",
    until: listboxOpen("#isc button"),
    scenarios: ["click", "hoverClick", "keyClick", "tapClick"],
  },
  "scroll-area": {
    path: "/scroll-area-cold",
    sel: "#hover",
    // hover: thumb measured (size var set); wheel: thumb moved
    until: `(() => { const t = document.getElementById("hover-thumb-y"); return !!t && (window.__b.scenario === "wheel" ? /translate3d\\(0px, [1-9]/.test(t.style.transform) : parseFloat(document.getElementById("hover-y")?.style.getPropertyValue("--rv-scroll-area-thumb-height") || "0") > 0); })()`,
    scenarios: ["hover", "wheel"],
  },
};

const ui = arg("app", "cdk") === "ui";
const repeats = +arg("repeats", "3");
const conditions = arg("conditions", "fast,slow").split(",");
const targets = arg("targets", ui ? "ui-select,ui-cell-select,ui-inline-select" : "sidebar,carousel,scroll-area").split(",");
const only = process.argv.includes("--scenarios") ? arg("scenarios", "").split(",") : null;
const trace = flag("trace");
const SLOW = { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8, cpu: 4 };
const appDir = fileURLToPath(new URL(ui ? "../../ui/tests-components/app/" : "./app/", import.meta.url));
const dist = process.argv.includes("--dist") ? arg("dist", "") : appDir + (process.env.STORIES_DIST ?? "dist");

if (flag("build")) {
  process.env.STORIES_DIST ??= dist.slice(appDir.length);
  const { buildApp } = await import(ui ? "../../ui/tests-components/app/serve.ts" : "./app/serve.ts");
  await buildApp();
}

const app = await start({ dist, port: 0, host: "127.0.0.1", onError: () => {}, preload: flag("lean") ? { lean: true } : undefined });
const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : NaN;
};

/** Page-side marks: first event timestamps + `until(pred)` resolving at the first paint after `pred` holds. */
function installMarks(): void {
  const m: any = ((window as any).__b = { marks: {} });
  for (const type of ["click", "pointerdown", "pointermove", "keydown", "wheel", "touchstart"])
    addEventListener(type, (e) => (m.marks[type] ??= e.timeStamp), { capture: true, passive: true });
  m.until = (pred: () => boolean) =>
    new Promise<void>((done) => {
      const check = () => {
        if (!pred()) return false;
        m.marks.hit = performance.now();
        requestAnimationFrame(() => {
          const c = new MessageChannel();
          c.port1.onmessage = () => (m.marks.paint = performance.now());
          c.port2.postMessage(0);
        });
        done();
        return true;
      };
      if (check()) return;
      const o = new MutationObserver(() => check() && o.disconnect());
      o.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    });
}

/** Which mark the latency starts from. */
const START: Record<string, string> = {
  drag: "pointerdown",
  click: "click",
  hoverClick: "click",
  keyClick: "keydown",
  tapClick: "touchstart",
  hover: "pointermove",
  wheel: "wheel",
};

async function input(page: Page, t: Target, scenario: string): Promise<void> {
  if (scenario === "click" || scenario === "hoverClick") await page.click(t.sel);
  else if (scenario === "keyClick") await page.keyboard.press("Enter");
  else if (scenario === "tapClick") await page.tap(t.sel);
  else if (scenario === "drag") {
    const box = (await page.locator(t.drag!).boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 250, y);
    await page.mouse.down();
    // Cold: the engine tracks the drag once its chunks ran (replayed mousedown); the gesture continues after that.
    await page.waitForFunction(() => document.querySelector("[data-dragging]") != null, null, { timeout: 30000 }).catch(() => {});
    await page.mouse.move(box.x + 60, y, { steps: 8 });
    await page.mouse.up();
  } else {
    const box = (await page.locator(t.sel).boundingBox())!;
    await page.mouse.move(box.x + 50, box.y + 50);
    if (scenario === "wheel") await page.mouse.wheel(0, 300);
  }
}

const rows: string[] = [];
for (const condition of conditions)
  for (const name of targets) {
    const t = TARGETS[name];
    if (!t) throw new Error(`unknown target ${name} (${Object.keys(TARGETS).join(", ")})`);
    if ((t.app === "ui") !== ui) throw new Error(`target ${name} belongs to --app ${t.app ?? "cdk"}`);
    for (const scenario of t.scenarios.filter((s) => !only || only.includes(s))) {
      let timeouts = 0;
      const lat: number[] = [],
        bytes: number[] = [],
        n: number[] = [],
        after: number[] = [],
        afterN: number[] = [];
      for (let r = 0; r < repeats; r++) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: scenario === "tapClick" });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const cdp = await context.newCDPSession(page);
        await cdp.send("Network.enable");
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        if (condition === "slow") {
          await cdp.send("Network.emulateNetworkConditions", {
            offline: false,
            latency: SLOW.latency,
            downloadThroughput: SLOW.download,
            uploadThroughput: SLOW.upload,
          });
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: SLOW.cpu });
        }
        const js = new Map<string, string>();
        const late: string[] = [];
        let inputAt = Infinity,
          before = 0,
          beforeN = 0,
          total = 0,
          lateN = 0;
        cdp.on("Network.responseReceived", (e: any) => /\.m?js(\?|$)/.test(e.response.url) && js.set(e.requestId, e.response.url));
        cdp.on("Network.loadingFinished", (e: any) => {
          const url = js.get(e.requestId);
          if (!url) return;
          total += e.encodedDataLength;
          if (Date.now() < inputAt) ((before += e.encodedDataLength), beforeN++);
          else (lateN++, trace && late.push(`    +${Date.now() - inputAt} ms ${url.replace(app.url, "")} ${e.encodedDataLength} B`));
        });
        await page.addInitScript(installMarks);
        await page.goto(app.url + t.path);
        await page.waitForTimeout(+arg("wait", condition === "slow" ? "6000" : "2500"));
        if (scenario === "keyClick") await page.focus(t.sel);
        if (scenario === "hoverClick") (await page.hover(t.sel), await page.waitForTimeout(600));
        await page.evaluate(`window.__b.scenario = ${JSON.stringify(scenario)}; window.__b.pending = window.__b.until(() => ${t.until}); 0`);
        const done = page.evaluate(() => (window as any).__b.pending);
        inputAt = Date.now();
        await input(page, t, scenario);
        const ok = await Promise.race([done.then(() => true), new Promise<boolean>((res) => setTimeout(() => res(false), 30000))]);
        if (ok) {
          await page.waitForFunction(() => (window as any).__b.marks.paint != null, null, { timeout: 30000 });
          const m = await page.evaluate(() => (window as any).__b.marks);
          lat.push(m.paint - m[START[scenario]!]);
          await page.waitForTimeout(1000);
        } else (lat.push(NaN), timeouts++);
        (bytes.push(before), n.push(beforeN), after.push(total), afterN.push(lateN));
        if (trace)
          console.log(
            `  ${condition} ${name} ${scenario} #${r}: ${ok ? lat.at(-1)!.toFixed(0) + " ms" : "TIMEOUT"}${errors.length ? " errors: " + errors.join(" | ") : ""}\n${late.join("\n")}`,
          );
        await context.close();
      }
      const row = [
        condition,
        name,
        scenario,
        `p50 ${median(lat).toFixed(1)} ms [${lat.map((x) => x.toFixed(0)).join(" ")}]`,
        `JS before ${median(n)} req ${(median(bytes) / 1024).toFixed(1)} KB`,
        `after input ${median(afterN)} req`,
        `total ${(median(after) / 1024).toFixed(1)} KB`,
        timeouts ? `TIMEOUTS ${timeouts}` : "",
      ].join("\t");
      console.log(row);
      rows.push(row);
    }
  }
await browser.close();
await app.close();
