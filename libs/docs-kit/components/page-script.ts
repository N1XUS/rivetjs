// Docs page script (ZERO Z13, 2026-10-25): the page-wide browser behaviour of docs pages as ONE plain module script —
// no resume runtime, no boundary. Each piece used to be a client trigger on a boundary that booted the resume runtime at
// idle on every docs page, before any input (`SiteFrame` `clientEffect(watchCode, { when: "idle" })`, `SearchButton`
// document listeners, `Toc` scroll listener; docs `/learn/resuming/`: +21 ms main-thread tasks, +3.3 MB JS heap at
// idle). Listeners live for the document, so client navigations keep them; code blocks a navigation adds are coloured too.
//  - code highlighter: at idle, colours code blocks near the viewport (`highlight-browser.ts`; not on `site.leanPages`)
//  - search: `/` and Ctrl/Cmd+K open the dialog (capture phase: cdk buttons stop the propagation of keys pressed on
//    them), a lone Ctrl / Meta down or a pointer over / focus of a search trigger fetches it (not on lean pages)
//  - TOC scroll-spy: marks the TOC link of the heading above the reading line (`browser.ts` `spy`)
//  - site chrome (RT-DIET2): theme menu / mobile drawer mounted on intent, search button click, code copy (below)
//  - benchmark charts (STATIC-ZERO-3): keyboard reading of a focused `BenchChart` plot (`bench-keys.ts`, bundled in)
// Loaded on first intent (DOCS-ZERO, 2026-10-27): `document.ts` links no module — its inline stub (`PAGE_STUB`) imports
// this module on the first pointerover / pointerdown / focusin / keydown / click, the first scroll of a page with a TOC,
// or at idle when a visible code block is left plain (dev server, runtime-filled blocks), or at load on `/search/?q=…`;
// built content pages fetch no JS before input. The stub queues the events it saw (`window.__rvDocs`; it already
// prevented the defaults this module prevents: Ctrl/Cmd+K, `/`, ArrowDown / ArrowUp on the theme button, chart keys on
// a focused chart plot, a plain search-button click) and this module replays them through its own listeners when it
// runs (`replay`).
// A .ts module: browser globals are fine. `<html data-lean>` = a `site.leanPages` page (set by `document.ts`).
import { spy, spyState } from "./browser.ts";
import { CODE_SELECTOR, watchCode } from "./highlight-browser.ts";
import * as benchKeys from "./bench-keys.ts";

const lean = document.documentElement.hasAttribute("data-lean");
const dialog = () => import("../search/dialog.tsx");

const onScroll = () => {
  if (spyState.queued || !document.querySelector(".toc-list")) return;
  spyState.queued = true;
  requestAnimationFrame(spy);
};
addEventListener("scroll", onScroll, { passive: true });

const onSearchKey = (event: KeyboardEvent) => {
  // Ctrl / Meta down: Ctrl+K / Cmd+K follows — fetch the dialog while the second key is on its way.
  if (event.key === "Control" || event.key === "Meta") return void dialog();
  const target = event.target as HTMLElement | null;
  const typing = target?.closest?.("input, textarea, select, [contenteditable='true']");
  if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
    if (!document.querySelector(".search-button")) return;
    event.preventDefault();
    void dialog().then((module) => module.openSearch());
  }
};
const warm = (event: Event) => {
  if (!(event.target as Element | null)?.closest?.(".search-button")) return;
  document.removeEventListener("pointerover", warm);
  document.removeEventListener("focusin", warm);
  void dialog();
};
if (!lean) {
  document.addEventListener("keydown", onSearchKey, { capture: true });
  document.addEventListener("pointerover", warm);
  document.addEventListener("focusin", warm);

  const highlight = () => {
    watchCode();
    if (typeof MutationObserver !== "function") return;
    new MutationObserver((records) => {
      const added: HTMLElement[] = [];
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches(CODE_SELECTOR)) added.push(node);
          for (const pre of node.querySelectorAll<HTMLElement>(CODE_SELECTOR)) added.push(pre);
        }
      if (added.length) watchCode(added);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(highlight, { timeout: 2000 });
  else setTimeout(highlight, 1);
}

// Site chrome (RT-DIET2 DOCS-CHROME, 2026-10-26): the top bar's theme menu and mobile drawer, the search buttons and
// the code copy buttons are plain server markup — no boundary, so a docs page boots no resume runtime / router / cdk
// before input. The menu and drawer modules are fetched when the pointer or focus reaches their button and their live
// cdk trigger replaces it then (same markup: the press is the cdk trigger's), or on an activation that came first
// (`theme-menu-open.tsx`, `mobile-menu-open.tsx`); search and copy act here.
const themeMenu = () => import("./theme-menu-open.tsx");
const mobileMenu = () => import("./mobile-menu-open.tsx");
const plain = (event: MouseEvent) => !(event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
// A press in progress: the static button stays until its click (swapping it between pointerdown and click would lose the
// click — a touch's pointerover comes right before its pointerdown); the click then opens it (`openThemeMenu`).
let pressing = false;
const chrome = (event: Event) => {
  const target = event.target as Element | null;
  const theme = target?.closest?.<HTMLButtonElement>(".theme-button[data-chrome]");
  if (theme) return void themeMenu().then((module) => pressing || module.liveThemeMenu(theme));
  const menu = target?.closest?.<HTMLButtonElement>(".menu-button[data-chrome]");
  if (menu) void mobileMenu().then((module) => pressing || module.liveMobileMenu(menu));
};
const press = () => (pressing = true);
const released = () => setTimeout(() => (pressing = false));
const onClick = (event: MouseEvent) => {
  const target = event.target as Element | null;
  // `data-chrome`: the static button (a mounted live trigger has its own handlers).
  const theme = target?.closest?.<HTMLButtonElement>(".theme-button[data-chrome]");
  if (theme) return void themeMenu().then((module) => module.openThemeMenu(theme, event));
  const menu = target?.closest?.<HTMLButtonElement>(".menu-button[data-chrome]");
  if (menu) return void mobileMenu().then((module) => module.openMobileMenu(menu, event));
  const search = target?.closest?.(".search-button");
  if (search && plain(event)) {
    event.preventDefault();
    return void dialog().then((module) => module.openSearch());
  }
  const copy = target?.closest?.<HTMLButtonElement>(".copy-button");
  if (copy) copyCode(copy);
};
const onArrow = (event: KeyboardEvent) => {
  // The menu button's ArrowDown / ArrowUp opens the menu (cdk MenuTrigger keys); Enter / Space arrive as clicks.
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const theme = (event.target as Element | null)?.closest?.<HTMLButtonElement>(".theme-button[data-chrome]");
  if (!theme) return;
  event.preventDefault();
  void themeMenu().then((module) => module.openThemeMenu(theme, event));
};
// Benchmark charts (STATIC-ZERO-3): the plot is server HTML with CSS hover tooltips; its keyboard reading
// (`bench-keys.ts`, ~0.3 KB br) is bundled into this script: as a dynamic import a Tab + arrow cost one more round trip
// (Slow 4G: 13 → 181 ms vs the canvas the runtime mounted at load). The stub prevents these keys' defaults on a plot too.
const CHART_KEYS = /^(Arrow(Up|Down|Left|Right)|Home|End|Escape)$/;
const plotOf = (event: Event) => {
  const target = event.target as Element | null;
  return target?.matches?.(".bench-plot") ? target : null;
};
const onChartKey = (event: KeyboardEvent) => {
  const plot = plotOf(event);
  if (!plot || !CHART_KEYS.test(event.key)) return;
  event.preventDefault();
  benchKeys.key(plot, event.key);
};
const onChartFocus = (event: Event) => {
  const plot = plotOf(event);
  if (plot && document.activeElement === plot && plot.matches(":focus-visible")) benchKeys.focus(plot);
};
const onChartBlur = (event: Event) => {
  const plot = plotOf(event);
  if (plot) benchKeys.blur(plot);
};
document.addEventListener("keydown", onChartKey);
document.addEventListener("focusin", onChartFocus);
document.addEventListener("focusout", onChartBlur);

document.addEventListener("pointerover", chrome, { passive: true });
document.addEventListener("focusin", chrome);
document.addEventListener("pointerdown", press, { capture: true, passive: true });
for (const type of ["click", "pointercancel"]) document.addEventListener(type, released, { capture: true, passive: true });
document.addEventListener("click", onClick);
document.addEventListener("keydown", onArrow);

/**
 * The events `document.ts`'s inline stub saw before this module ran (`window.__rvDocs`), through the listeners above in
 * dispatch order (capture before bubble, as the browser ran them). Setting the global to null stops the stub.
 */
function replay(events: readonly Event[]): void {
  for (const event of events) {
    const type = event.type;
    if (type === "scroll") onScroll();
    else if (type === "keydown") {
      if (!lean) onSearchKey(event as KeyboardEvent);
      onArrow(event as KeyboardEvent);
      onChartKey(event as KeyboardEvent);
    } else if (type === "pointerover" || type === "focusin") {
      if (!lean) warm(event);
      chrome(event);
      if (type === "focusin") onChartFocus(event);
    } else if (type === "pointerdown") press();
    else if (type === "click") {
      released();
      onClick(event as MouseEvent);
    }
  }
}
// The search page with a query (`/search/?q=…`: its form, a shared search link): the dialog opens with it. The stub
// imports this module at load on that page only (STATIC-ZERO-3: the route itself is static).
const query = document.querySelector(".search-page-form") ? new URLSearchParams(location.search).get("q") : null;
if (query !== null) void dialog().then((module) => module.openSearch(query));

const stub = window as unknown as { __rvDocs?: Event[] | null };
const queued = stub.__rvDocs;
stub.__rvDocs = null;
if (queued) replay(queued);

/** Copy the first visible `<pre>` of the button's `.code-block` / `.code-panel` (the open tab, or a compiled block's source). */
function copyCode(button: HTMLButtonElement): void {
  const block = button.closest(".code-block, .code-panel");
  const pres = block ? [...block.querySelectorAll("pre")] : [];
  const pre = pres.find((p) => p.offsetParent !== null) ?? pres[0];
  if (!pre) return;
  // A block the highlighter filled at runtime (example "Server HTML") holds its lines in a shadow root (ADOPT-CONTENT).
  void navigator.clipboard.writeText((pre.querySelector(".line")?.shadowRoot ?? pre).textContent ?? "").then(
    () => {
      button.dataset.copied = "";
      button.setAttribute("aria-label", "Copied");
      setTimeout(() => {
        delete button.dataset.copied;
        button.setAttribute("aria-label", "Copy code");
      }, 1500);
    },
    () => button.setAttribute("aria-label", "Press Ctrl+C to copy"),
  );
}
