// The docs page script's inline intent stub (DOCS-ZERO 2026-10-27; chrome closures THEME-JS 2026-10-28), written into
// every docs page's head script by `document.ts`. A plain string builder (no virtual modules): `tests/page-stub.test.ts`
// runs it in Chromium.

/**
 * Lazy chrome parts of the docs page script (`docsSite()` client build → `SCRIPTS_FILE` `parts`): `urls` = every part's
 * files (the part's chunk + its static imports, minus what the page script itself loads), `lists` = `[selector, indexes
 * into urls]` per part.
 */
export interface StubParts {
  urls: string[];
  lists: [selector: string, files: number[]][];
}

/**
 * The docs page script, on first intent (DOCS-ZERO 2026-10-27): built content pages fetch no JS before input. Inline in
 * the head script (~0.4 KB br, below the docs page script's 1.9 KB br module + request on every page view), it imports
 * `src` on the first pointerover / pointerdown / focusin / keydown / click (capture), on the first scroll of a page with a
 * TOC (`.toc-list`: scroll-spy), or after parsing at idle when a code block is visible and left plain
 * (`pre[data-lang]:not([data-hl])` = `highlight-browser.ts` `CODE_SELECTOR`, `checkVisibility()`: hidden "Server HTML"
 * tabs wait for their tab press), or after parsing on the search page with a query (`/search/?q=…`: the dialog opens with
 * it; STATIC-ZERO-3, the route is static), with a `modulepreload` of the script's static imports (`imports`: the preload
 * helper — one round trip, not two). It queues those events on `window.__rvDocs` for the module's `replay`, and does now the
 * defaults the module prevents (they cannot wait for a fetch): Ctrl/Cmd+K and `/` (not typing; not on `<html
 * data-lean>`; only with a `.search-button`), ArrowDown / ArrowUp on the static theme button, arrows / Home / End /
 * Escape on a focused benchmark chart plot (`.bench-plot`, STATIC-ZERO-3), a plain click on a
 * `.search-button` link (a failed import follows that link). Once the module ran (`__rvDocs` = null) the stub detaches.
 *
 * Chrome closures (THEME-JS 2026-10-28): an event of those whose target is inside a part's selector (theme button,
 * mobile menu button, search button; the search shortcut keys count for `.search-button`) also modulepreloads that
 * part's whole closure (`parts`), once: the part the page script imports for it arrives with the script, not one round
 * trip after it (ui-docs theme menu, press with no pointer movement before it, 400 ms RTT, HTTP/2: 2 → 1 round trip).
 * The same files the page script fetched on that pointerover / focus before, only earlier; none before input.
 * Measured against the external module script (glossary, Lighthouse mobile): see `libs/docs-kit/CLAUDE.md`.
 */
export const PAGE_STUB = (src: string, imports: string[], parts: StubParts = { urls: [], lists: [] }) =>
  '(function(u,D,U,S){var d=document,w=window,q=w.__rvDocs=[],T=["pointerover","pointerdown","focusin","keydown","click"],l;' +
  'function p(x){var k=d.createElement("link");k.rel="modulepreload";k.href=x;d.head.appendChild(k)}' +
  'function g(){if(l)return;for(var x of D)p(x);l=import(u).catch(function(){for(var e of q){var a=e.type=="click"&&e.target.closest&&e.target.closest(".search-button");if(a)location.href=a.href}})}' +
  "function h(e){if(w.__rvDocs!==q){for(var n of T)d.removeEventListener(n,h,!0);return}" +
  "var t=e.target,c=function(s){return t&&t.closest?t.closest(s):null},k=e.key,f=0;" +
  'if(e.type=="keydown"){f=!d.documentElement.hasAttribute("data-lean")&&d.querySelector(".search-button")&&(k=="k"&&(e.metaKey||e.ctrlKey)||k=="/"&&!c("input,textarea,select,[contenteditable=\'true\']"));if((k=="ArrowDown"||k=="ArrowUp")&&c(".theme-button[data-chrome]")||/^(Arrow|Home$|End$|Escape$)/.test(k)&&t&&t.matches&&t.matches(".bench-plot")||f)e.preventDefault()}' +
  'else if(e.type=="click"&&c(".search-button")&&!(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey))e.preventDefault();' +
  'for(var P of S)if(!P[2]&&(c(P[0])||f&&P[0]==".search-button")){P[2]=1;for(var i of P[1])p(U[i])}' +
  "q.push(e);g()}" +
  "for(var n of T)d.addEventListener(n,h,!0);" +
  'addEventListener("scroll",function s(e){if(d.querySelector(".toc-list")){removeEventListener("scroll",s);w.__rvDocs===q&&q.push(e);g()}},{passive:!0});' +
  'function i(){for(var p of d.querySelectorAll("pre[data-lang]:not([data-hl])"))if(!p.checkVisibility||p.checkVisibility())return g()}' +
  'function j(){if(/[?&]q=/.test(location.search)&&d.querySelector(".search-page-form"))return g();w.requestIdleCallback?requestIdleCallback(i,{timeout:2e3}):setTimeout(i,1)}d.readyState=="loading"?d.addEventListener("DOMContentLoaded",j):j()' +
  `})(${JSON.stringify(src)},${JSON.stringify(imports)},${JSON.stringify(parts.urls)},${JSON.stringify(parts.lists)});`;
