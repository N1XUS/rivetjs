import { headTags, type DocumentShell } from "@rivetjs/router/server";
import { FRAME_HEIGHT, FRAME_THEME, frameIdOf, PARENT_FRAME_HEIGHT, PARENT_THEME_BRIDGE } from "./frame-theme.ts";
import { site } from "virtual:docs/site";
// Favicon: the Rivet logo (repo root logo.svg, emitted as a hashed asset by `docsSite()`).
import { logo } from "virtual:docs/brand";
// The docs page script (ZERO Z13): highlighter, search shortcuts, TOC spy, site chrome without the resume runtime
// (`components/page-script.ts`), imported on first intent by `PAGE_STUB` (DOCS-ZERO).
import { pageScript, pageScriptImports, routeScript } from "virtual:docs/scripts";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
// Applies the saved theme (`localStorage.theme`: "light" | "dark"; absent = follow the system) before
// first paint: `data-theme` = the theme in use, `data-theme-pref` = the choice (theme menu). With
// "system", later OS changes apply live; a choice made in another tab (`storage`) or while this page sat
// in the back / forward cache (`pageshow`) is applied too. Static pages allow it by hash (hashCSP); server pages
// (the dev server's CSP included) by the request nonce. Then the bridges that hand the theme to example
// frames and size auto-height frames (`frame-theme.ts`).
const themeScript = (nonce: string | undefined, stub = "") =>
  `<script${nonce === undefined ? "" : ` nonce="${escape(nonce)}"`}>` +
  '(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)"),p;try{p=localStorage.getItem("theme")}catch(e){}if(p!=="light"&&p!=="dark")p="system";d.dataset.themePref=p;function a(){d.dataset.theme=d.dataset.themePref==="system"?(m.matches?"dark":"light"):d.dataset.themePref}a();m.addEventListener("change",a);' +
  'function r(){var v;try{v=localStorage.getItem("theme")}catch(e){}d.dataset.themePref=v==="light"||v==="dark"?v:"system";a()}addEventListener("storage",function(e){if(e.key==="theme"||e.key===null)r()});addEventListener("pageshow",function(e){if(e.persisted)r()})})();' +
  AFTER_PAINT +
  PARENT_THEME_BRIDGE +
  ";" +
  PARENT_FRAME_HEIGHT +
  stub +
  "</script>";
// After the first paint (`AFTER_PAINT`: first contentful paint → task; browsers without paint timing: `load` → task;
// or the first pointerover / pointerdown / touchstart / keydown / focusin, whichever comes first: the full sheets are
// on their way before a click opens an overlay whose names are not in the page's critical CSS):
// - Full stylesheets: built pages inline their critical CSS and keep the head stylesheets as
//   `<link rel="x-rivet-defer">` (tools/critical-css.ts); they become stylesheets here. Pages without (dev server,
//   server pages) have none.
const AFTER_PAINT =
  "(function(){var t=0;function a(){" +
  'for(var l of document.querySelectorAll(\'link[rel="x-rivet-defer"]\'))l.rel="stylesheet"}function g(){t||(t=setTimeout(a,0))}' +
  'try{if(PerformanceObserver.supportedEntryTypes.indexOf("paint")<0)throw 0;new PerformanceObserver(function(l,b){if(l.getEntriesByName("first-contentful-paint").length){b.disconnect();g()}}).observe({type:"paint",buffered:true})}' +
  'catch(e){addEventListener("load",g)}for(var n of["pointerover","pointerdown","touchstart","keydown","focusin"])addEventListener(n,g,{capture:true,once:true,passive:true})})();';

/**
 * Example frame pages (`/examples/<id>/frame/…`): the example's own document, as the static starter writes it (its
 * head, its stylesheets from the head links), plus the frame script (theme + content height, `frame-theme.ts`) — none of the docs' stylesheets, fonts or
 * theme script.
 */
const frameDocument: DocumentShell = ({ head, nonce, managed }) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags({ ...head, title: head?.title ?? "Example" }, { nonce, managed }) +
    `<script id="rivet-docs-frame"${nonce === undefined ? "" : ` nonce="${escape(nonce)}"`}>${FRAME_THEME};${FRAME_HEIGHT}</script>` +
    "</head><body>",
  end: "</body></html>",
});

/** Document around every page. Route heads (title, description, links, scripts) merge over the defaults. */
const document: DocumentShell = (input) => (frameIdOf(input.url.pathname) ? frameDocument(input) : siteDocument(input));

/**
 * The docs page script, on first intent (DOCS-ZERO 2026-10-27): built content pages fetch no JS before input. Inline in
 * the head script (~0.4 KB br, below the docs page script's 1.9 KB br module + request on every page view), it imports
 * `src` on the first pointerover / pointerdown / focusin / keydown / click (capture), on the first scroll of a page with a
 * TOC (`.toc-list`: scroll-spy), or after parsing at idle when a code block is visible and left plain
 * (`pre[data-lang]:not([data-hl])` = `highlight-browser.ts` `CODE_SELECTOR`, `checkVisibility()`: hidden "Server HTML"
 * tabs wait for their tab press), or after parsing on the search page with a query (`/search/?q=…`: the dialog opens with
 * it; STATIC-ZERO-3, the route is static), with a `modulepreload` of the script's static imports (`pageScriptImports()`: the preload
 * helper — one round trip, not two). It queues those events on `window.__rvDocs` for the module's `replay`, and does now the
 * defaults the module prevents (they cannot wait for a fetch): Ctrl/Cmd+K and `/` (not typing; not on `<html
 * data-lean>`; only with a `.search-button`), ArrowDown / ArrowUp on the static theme button, arrows / Home / End /
 * Escape on a focused benchmark chart plot (`.bench-plot`, STATIC-ZERO-3), a plain click on a
 * `.search-button` link (a failed import follows that link). Once the module ran (`__rvDocs` = null) the stub detaches.
 * Measured against the external module script (glossary, Lighthouse mobile): see `libs/docs-kit/CLAUDE.md`.
 */
const PAGE_STUB = (src: string, imports: string[]) =>
  '(function(u,D){var d=document,w=window,q=w.__rvDocs=[],T=["pointerover","pointerdown","focusin","keydown","click"],l;' +
  'function g(){if(l)return;for(var x of D){var k=d.createElement("link");k.rel="modulepreload";k.href=x;d.head.appendChild(k)}l=import(u).catch(function(){for(var e of q){var a=e.type=="click"&&e.target.closest&&e.target.closest(".search-button");if(a)location.href=a.href}})}' +
  "function h(e){if(w.__rvDocs!==q){for(var n of T)d.removeEventListener(n,h,!0);return}" +
  "var t=e.target,c=function(s){return t&&t.closest?t.closest(s):null},k=e.key;" +
  'if(e.type=="keydown"){if((k=="ArrowDown"||k=="ArrowUp")&&c(".theme-button[data-chrome]")||/^(Arrow|Home$|End$|Escape$)/.test(k)&&t&&t.matches&&t.matches(".bench-plot")||!d.documentElement.hasAttribute("data-lean")&&d.querySelector(".search-button")&&(k=="k"&&(e.metaKey||e.ctrlKey)||k=="/"&&!c("input,textarea,select,[contenteditable=\'true\']")))e.preventDefault()}' +
  'else if(e.type=="click"&&c(".search-button")&&!(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey))e.preventDefault();' +
  "q.push(e);g()}" +
  "for(var n of T)d.addEventListener(n,h,!0);" +
  'addEventListener("scroll",function s(e){if(d.querySelector(".toc-list")){removeEventListener("scroll",s);w.__rvDocs===q&&q.push(e);g()}},{passive:!0});' +
  'function i(){for(var p of d.querySelectorAll("pre[data-lang]:not([data-hl])"))if(!p.checkVisibility||p.checkVisibility())return g()}' +
  'function j(){if(/[?&]q=/.test(location.search)&&d.querySelector(".search-page-form"))return g();w.requestIdleCallback?requestIdleCallback(i,{timeout:2e3}):setTimeout(i,1)}d.readyState=="loading"?d.addEventListener("DOMContentLoaded",j):j()' +
  `})(${JSON.stringify(src)},${JSON.stringify(imports)});`;

/** `;` + the stub for this build's docs page script (none in the browser bundle / unbuilt). */
const pageStub = () => {
  const src = pageScript();
  return src ? ";" + PAGE_STUB(src, pageScriptImports()) : "";
};

/** The page's own script (`docsSite({ scripts })`), low priority: a High module script started before first paint counts as render-blocking in Lighthouse's simulation. */
const routeScriptTag = (nonce: string | undefined, pathname: string) => {
  const own = routeScript(pathname);
  return own ? `<script type="module" src="${escape(own)}" fetchpriority="low"${nonce === undefined ? "" : ` nonce="${escape(nonce)}"`}></script>` : "";
};

const siteDocument: DocumentShell = ({ head, nonce, styles, managed, url }) => ({
  start:
    `<!doctype html><html lang="en"${site.leanPages?.includes(url.pathname) ? " data-lean" : ""}>` +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    themeScript(nonce, pageStub()) +
    // The whole route head (scripts included: a route `head.scripts` entry is written, nonce'd on server pages).
    headTags(
      {
        ...head,
        title: head?.title ?? site.name,
        meta: head?.meta?.some((m) => m.name === "description") ? head.meta : [{ name: "description", content: site.tagline }, ...(head?.meta ?? [])],
      },
      { nonce, managed },
    ) +
    '<meta name="color-scheme" content="light dark">' +
    `<link rel="icon" type="image/svg+xml" href="${logo}">` +
    styles.map((href) => `<link rel="stylesheet" href="${escape(href)}">`).join("") +
    routeScriptTag(nonce, url.pathname) +
    "</head><body>",
  end: "</body></html>",
});
export default document;
