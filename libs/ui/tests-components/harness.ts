// Story app harness: production build (client + server), node adapter, one Chromium for a test file.
import { chromium, type Browser, type Page } from "playwright";
import { start } from "@rivetjs/router/node";
import { buildApp, dist } from "./app/serve.ts";

let built: Promise<void> | null = null;

export interface Stories {
  origin: string;
  browser: Browser;
  close(): Promise<void>;
}

/** Build once per process, start the server and a browser. */
export async function stories(): Promise<Stories> {
  await (built ??= buildApp());
  const app = await start({ dist, port: 0, host: "127.0.0.1", onError: () => {} });
  const browser = await chromium.launch({ headless: true, args: ["--use-mock-keychain", "--password-store=basic"] });
  return {
    origin: app.url,
    browser,
    async close() {
      await browser.close();
      await app.close();
    },
  };
}

export interface Watch {
  scripts: string[];
  errors: string[];
}

/** Record script requests and page errors. */
export function watch(page: Page): Watch {
  const seen: Watch = { scripts: [], errors: [] };
  page.on("request", (request) => {
    if (request.resourceType() === "script" || /\.m?js$/.test(new URL(request.url()).pathname)) seen.scripts.push(new URL(request.url()).pathname);
  });
  page.on("pageerror", (error) => seen.errors.push(error.message));
  return seen;
}

/** Library chunks requested so far (aria / cdk symbols and modules). */
export const libraryScripts = (seen: Watch): string[] =>
  seen.scripts.filter((url) =>
    /resume-(ListBox|ListBoxView|ListBoxOptions|Tabs|Menu|MenuTrigger|SubmenuTrigger|MenuView|ComboBox|Select|Autocomplete|Dialog|Popover|ToggleButton|Button|Checkbox|Switch|RadioGroup|TextField|Disclosure)-|behaviour|collections-|selection-|interactions-|overlay-|options-/.test(
      url,
    ),
  );

/** Focused element: id, role, data-key. */
export const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { id: el?.id ?? "", role: el?.getAttribute("role") ?? "", key: el?.getAttribute("data-key") ?? "" };
  });

/** Runtime entry chunks every resumed page preloads (resume runtime, format, router App, DOM runtime + spread, shared `reactivity` chunk: split out once cdk modules join the bundle; runtime `props` (live props): split out once the scroll-shadow route joined; `resume-loader`: the resume loader module, LOADER-DIET's deferred half of the former inline loader, imported after the first frame on pages with `data-preload` — it evaluates no component code). The router client stays inside `resume-App`: `@rivetjs/forms` (ui `Form`) reaches the router through `Symbol.for("rivet.router")` instead of importing it (FOLD 2026-10-12). Exact names: each
 * alternative + `-` + the 8-char Vite hash (`[\w-]`, hashes may contain `-`), so `dom` cannot match `dom-<anything>-<hash>.js`. */
export const RUNTIME_ENTRY =
  /\/assets\/(resume-entry|resume-format|resume-loader|resume-App|dom-router|dom|dom-v2-spread|dom-v2-controls|preload-helper|reactivity|props)-[\w-]{8}\.js$/;

/** Scripts requested so far other than the runtime entry chunks: ui components, `dom.*` symbols, route modules. */
export const nonRuntimeScripts = (seen: Watch): string[] => seen.scripts.filter((url) => !RUNTIME_ENTRY.test(url));

/** One animation frame of {@link traceFade}: the element's computed opacity + backdrop blur, state attributes, running animation count. */
export interface FadeSample {
  t: number;
  /** Element absent (not mounted). */
  gone: boolean;
  opacity: number;
  entering: boolean;
  exiting: boolean;
  running: number;
  /** Computed `backdrop-filter` blur radius in px (0 for `none`). */
  blur: number;
}

/**
 * Samples the first `selector` match every animation frame for `ms` (start before opening); `samples()` reads the trace,
 * `now()` is the current trace time (call it right before closing).
 */
export async function traceFade(page: Page, selector: string, ms = 3000): Promise<{ samples: () => Promise<FadeSample[]>; now: () => Promise<number> }> {
  const key = "__fade" + Math.random().toString(36).slice(2);
  await page.evaluate(
    ([selector, key, ms]) => {
      const log: unknown[] = ((window as unknown as Record<string, unknown[]>)[key as string] = []);
      const t0 = performance.now();
      (window as unknown as Record<string, number>)[key + "t0"] = t0;
      const sample = () => {
        const el = document.querySelector(selector as string);
        log.push(
          el
            ? {
                t: performance.now() - t0,
                gone: false,
                opacity: Number(getComputedStyle(el).opacity),
                entering: el.getAttribute("data-entering") === "true",
                exiting: el.getAttribute("data-exiting") === "true",
                running: el.getAnimations().filter((a) => a.playState === "running").length,
                blur: Number(/blur\(([\d.]+)px\)/.exec(getComputedStyle(el).backdropFilter)?.[1] ?? 0),
              }
            : { t: performance.now() - t0, gone: true, opacity: 0, entering: false, exiting: false, running: 0, blur: 0 },
        );
        if (performance.now() - t0 < (ms as number)) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    [selector, key, ms] as const,
  );
  return {
    samples: () => page.evaluate((key) => (window as unknown as Record<string, FadeSample[]>)[key], key),
    now: () => page.evaluate((key) => performance.now() - (window as unknown as Record<string, number>)[key + "t0"], key),
  };
}

/**
 * Asserts a trace shows a fade in after opening (a frame with a running animation and 0 < opacity < 1 before opacity 1)
 * and, from `closedAt` (trace ms), a fade out while still mounted (`data-exiting`, running, 0 < opacity < 1) before the
 * element is gone.
 */
export function assertFades(samples: FadeSample[], closedAt: number, label: string): void {
  const opened = samples.filter((s) => !s.gone && s.t < closedAt);
  const midIn = opened.find((s) => s.running > 0 && s.opacity > 0.02 && s.opacity < 0.98);
  if (!midIn) throw new Error(`${label}: no fade in (${JSON.stringify(opened.slice(0, 6))})`);
  const settled = opened.find((s) => s.t > midIn.t && s.opacity === 1 && s.running === 0 && !s.entering);
  if (!settled) throw new Error(`${label}: the fade in never settled at opacity 1`);
  const closing = samples.filter((s) => s.t >= closedAt);
  const midOut = closing.find((s) => !s.gone && s.exiting && s.running > 0 && s.opacity > 0.02 && s.opacity < 0.98);
  if (!midOut) throw new Error(`${label}: no fade out while mounted (${JSON.stringify(closing.slice(0, 6))})`);
  if (!closing.some((s) => s.t > midOut.t && s.gone)) throw new Error(`${label}: not unmounted after the fade out`);
}
