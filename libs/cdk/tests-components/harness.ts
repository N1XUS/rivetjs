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

/**
 * Build once per process, start the server and a browser. `preload`: the server's preload planner option
 * (e.g. `{ background: 0 }` for viewport-only `visible` timing; default: the router's 1 MiB background budget).
 */
export async function stories(options: { preload?: NonNullable<Parameters<typeof start>[0]>["preload"] } = {}): Promise<Stories> {
  await (built ??= buildApp());
  const app = await start({ dist, port: 0, host: "127.0.0.1", onError: () => {}, ...(options.preload ? { preload: options.preload } : {}) });
  const browser = await chromium.launch({ headless: true });
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

/**
 * Arm before `goto`: stamps the page clock (`performance.now()`) when deferred loading may start — the first
 * `requestIdleCallback` callback (the resume loader's idle boot / preloads, speculative activation after boot) or the
 * first `modulepreload` link appended after parsing (the loader's deferred preload queue, lazy-import preloads),
 * whichever comes first. Chunks requested before it are what the page loads by itself.
 */
export async function markDeferred(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __rvDeferredAt?: number };
    const stamp = () => (w.__rvDeferredAt ??= performance.now());
    const ric = window.requestIdleCallback;
    if (ric) window.requestIdleCallback = (callback, options) => ric.call(window, (deadline) => (stamp(), callback(deadline)), options);
    const observer = new MutationObserver((records) => {
      if (document.readyState === "loading") return;
      for (const record of records)
        for (const node of record.addedNodes)
          if ((node as Element).localName === "link" && (node as HTMLLinkElement).rel === "modulepreload") return void (stamp(), observer.disconnect());
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

/** Script paths requested before the `markDeferred` stamp (all so far when it has not fired yet). */
export const scriptsBeforeDeferred = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const at = (window as unknown as { __rvDeferredAt?: number }).__rvDeferredAt ?? Infinity;
    return performance
      .getEntriesByType("resource")
      .filter((entry) => entry.startTime < at && /\.m?js$/.test(new URL(entry.name).pathname))
      .map((entry) => new URL(entry.name).pathname);
  });

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
