// Docs page script (ZERO Z13, 2026-10-25): the page-wide browser behaviour of docs pages as ONE plain module script —
// no resume runtime, no boundary. Each piece used to be a client trigger on a boundary that booted the resume runtime at
// idle on every docs page, before any input (`SiteFrame` `clientEffect(watchCode, { when: "idle" })`, `SearchButton`
// document listeners, `Toc` scroll listener; docs `/learn/resuming/`: +21 ms main-thread tasks, +3.3 MB JS heap at
// idle): `document.ts` links this script on every docs page (not example frames). Listeners live for the document, so
// client navigations keep them; code blocks a navigation adds are coloured too.
//  - code highlighter: at idle, colours code blocks near the viewport (`highlight-browser.ts`; not on `site.leanPages`)
//  - search: `/` and Ctrl/Cmd+K open the dialog (capture phase: cdk buttons stop the propagation of keys pressed on
//    them), a lone Ctrl / Meta down or a pointer over / focus of a search trigger fetches it (not on lean pages)
//  - TOC scroll-spy: marks the TOC link of the heading above the reading line (`browser.ts` `spy`)
// A .ts module: browser globals are fine. `<html data-lean>` = a `site.leanPages` page (set by `document.ts`).
import { spy, spyState } from "./browser.ts";
import { CODE_SELECTOR, watchCode } from "./highlight-browser.ts";

const lean = document.documentElement.hasAttribute("data-lean");
const dialog = () => import("../search/dialog.tsx");

addEventListener(
  "scroll",
  () => {
    if (spyState.queued || !document.querySelector(".toc-list")) return;
    spyState.queued = true;
    requestAnimationFrame(spy);
  },
  { passive: true },
);

if (!lean) {
  document.addEventListener(
    "keydown",
    (event) => {
      // Ctrl / Meta down: Ctrl+K / Cmd+K follows — fetch the dialog while the second key is on its way.
      if (event.key === "Control" || event.key === "Meta") return void dialog();
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        if (!document.querySelector(".search-button")) return;
        event.preventDefault();
        void dialog().then((module) => module.openSearch());
      }
    },
    { capture: true },
  );
  const warm = (event: Event) => {
    if (!(event.target as Element | null)?.closest?.(".search-button")) return;
    document.removeEventListener("pointerover", warm);
    document.removeEventListener("focusin", warm);
    void dialog();
  };
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
