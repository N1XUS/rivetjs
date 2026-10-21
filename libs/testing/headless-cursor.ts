// Headless cursor guard: CI parity for Chromium's virtual mouse cursor.
//
// Headless Chromium on Linux (CI, `ubuntu-latest`) keeps a virtual cursor at the screen origin and dispatches trusted
// pointer / mouse events there after layout: on load, and again whenever the content under (0, 0) changes. On macOS
// nothing is dispatched until a test moves the mouse. A page whose first link / control sits at the origin (router
// fixtures, story pages, Vitest browser-mode renders) then got hover intents nobody scripted: link prefetches, chunk
// loads "before interaction", `data-hovered`, extra `pointerenter` calls (CI-RED 2026-10-20 found it for the size
// report; CI-RED-2 2026-10-21 for the suites).
//
// The guard swallows trusted pointer / mouse over, enter and move events at screen (0, 0) — capture phase on the
// window, before any page listener — and the matching out / leave of the elements whose arrival it swallowed, so CI
// and macOS see the same events. Scripted input never lands there (Playwright / Vitest target element centres);
// `page.mouse.move(0, 0)` ("move away") still delivers out / leave to the element it leaves, only the arrival at the
// origin is swallowed. CSS `:hover` is not affected.
// `window.__rivetOriginPointer` counts swallowed events per type (diagnostics).
//
// Node suites: `node-env.ts` installs it in every Playwright browser context (client instrumentation, init script).
// Vitest browser mode: `browser-env.ts` runs it in the tester frame. `RIVET_HEADLESS_CURSOR=origin` reproduces the CI
// cursor on macOS (approximately: the mouse moves to (0, 0) on every `domcontentloaded`; macOS dispatches nothing at
// later layout changes).

/** In-page guard. Self-contained: Playwright sends its source as an init script. Idempotent. */
export function guardOriginPointer(): void {
  const w = window as unknown as { __rivetOriginPointer?: Record<string, number> };
  if (w.__rivetOriginPointer) return;
  const counts: Record<string, number> = (w.__rivetOriginPointer = {});
  // Arrival → its departure: an element whose arrival was swallowed gets no departure either (as if the cursor had never
  // been at the origin); a later scripted arrival makes it a real one again.
  const pairs: Record<string, string> = { pointerover: "pointerout", pointerenter: "pointerleave", mouseover: "mouseout", mouseenter: "mouseleave" };
  const swallowed = new Map<string, WeakSet<EventTarget>>();
  for (const type of Object.values(pairs)) swallowed.set(type, new WeakSet());
  const drop = (event: Event) => {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
    event.stopImmediatePropagation();
  };
  for (const type of ["pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove"])
    addEventListener(
      type,
      (event) => {
        const e = event as MouseEvent;
        if (!e.isTrusted || !e.target) return;
        const departure = pairs[type];
        const departures = departure ? swallowed.get(departure) : undefined;
        if (e.screenX !== 0 || e.screenY !== 0) return void departures?.delete(e.target);
        departures?.add(e.target);
        drop(e);
      },
      { capture: true },
    );
  for (const type of Object.values(pairs))
    addEventListener(
      type,
      (event) => {
        const set = swallowed.get(type)!;
        if (event.isTrusted && event.target && set.has(event.target)) {
          set.delete(event.target);
          drop(event);
        }
      },
      { capture: true },
    );
}

interface PlaywrightLike {
  _instrumentation?: { addListener(listener: Record<string, (...args: never[]) => unknown>): void };
}
interface PageLike {
  mouse: { move(x: number, y: number): Promise<void> };
  on(event: "domcontentloaded", listener: () => void): void;
}
interface ContextLike {
  addInitScript(script: () => void): Promise<void>;
  on(event: "page", listener: (page: PageLike) => void): void;
}

/** Adds the guard to every browser context the given in-process Playwright creates (`newContext`, `newPage`, persistent). */
export function installPlaywrightGuard(playwright: unknown): void {
  const pw = playwright as PlaywrightLike & { __rivetCursorGuard?: true };
  if (pw.__rivetCursorGuard || !pw._instrumentation) return;
  pw.__rivetCursorGuard = true;
  const origin = process.env.RIVET_HEADLESS_CURSOR === "origin";
  pw._instrumentation.addListener({
    runAfterCreateBrowserContext: async (context: ContextLike) => {
      await context.addInitScript(guardOriginPointer);
      if (origin) context.on("page", (page) => page.on("domcontentloaded", () => void page.mouse.move(0, 0).catch(() => {})));
    },
  });
}
