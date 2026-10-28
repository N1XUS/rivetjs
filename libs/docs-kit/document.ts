import { headTags, type DocumentShell } from "@rivetjs/router/server";
import {
  FRAME_HEIGHT,
  FRAME_JS_METER,
  FRAME_THEME,
  frameIdOf,
  PARENT_FRAME_HEIGHT,
  PARENT_FRAME_JS_METER,
  PARENT_THEME_BRIDGE,
  pathIn,
} from "./frame-theme.ts";
import { site } from "virtual:docs/site";
// Favicon: the Rivet logo (repo root logo.svg, emitted as a hashed asset by `docsSite()`).
import { logo } from "virtual:docs/brand";
// The docs page script (ZERO Z13): highlighter, search shortcuts, TOC spy, site chrome without the resume runtime
// (`components/page-script.ts`), imported on first intent by `PAGE_STUB` (`page-stub.ts`, DOCS-ZERO).
import { pageScript, pageScriptImports, pageScriptParts, routeScript } from "virtual:docs/scripts";
import { PAGE_STUB } from "./page-stub.ts";

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
// Applies the saved theme (`localStorage.theme`: "light" | "dark"; absent = follow the system) before
// first paint: `data-theme` = the theme in use, `data-theme-pref` = the choice (theme menu). With
// "system", later OS changes apply live; a choice made in another tab (`storage`) or while this page sat
// in the back / forward cache (`pageshow`) is applied too. Static pages allow it by hash (hashCSP); server pages
// (the dev server's CSP included) by the request nonce. Then the bridges that hand the theme to example
// frames and size auto-height frames (`frame-theme.ts`); on a `site.frameMeters` page also the JS meter receiver.
const themeScript = (nonce: string | undefined, stub = "", meter = false) =>
  `<script${nonce === undefined ? "" : ` nonce="${escape(nonce)}"`}>` +
  '(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)"),p;try{p=localStorage.getItem("theme")}catch(e){}if(p!=="light"&&p!=="dark")p="system";d.dataset.themePref=p;function a(){d.dataset.theme=d.dataset.themePref==="system"?(m.matches?"dark":"light"):d.dataset.themePref}a();m.addEventListener("change",a);' +
  'function r(){var v;try{v=localStorage.getItem("theme")}catch(e){}d.dataset.themePref=v==="light"||v==="dark"?v:"system";a()}addEventListener("storage",function(e){if(e.key==="theme"||e.key===null)r()});addEventListener("pageshow",function(e){if(e.persisted)r()})})();' +
  AFTER_PAINT +
  PARENT_THEME_BRIDGE +
  ";" +
  PARENT_FRAME_HEIGHT +
  (meter ? ";" + PARENT_FRAME_JS_METER : "") +
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
 * head, its stylesheets from the head links), plus the frame script (theme + content height, + the JS meter reporter for a
 * `site.frameMeters` frame, `frame-theme.ts`) — none of the docs' stylesheets, fonts or
 * theme script.
 */
/** A frame page some `site.frameMeters` page meters: it reports its JS files (`FRAME_JS_METER`). */
const metered = (id: string | undefined) => !!id && Object.values(site.frameMeters ?? {}).some((ids) => ids.includes(id));

const frameDocument: DocumentShell = ({ head, nonce, managed, url }) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags({ ...head, title: head?.title ?? "Example" }, { nonce, managed }) +
    `<script id="rivet-docs-frame"${nonce === undefined ? "" : ` nonce="${escape(nonce)}"`}>${FRAME_THEME};${FRAME_HEIGHT}${metered(frameIdOf(url.pathname)) ? ";" + FRAME_JS_METER : ""}</script>` +
    "</head><body>",
  end: "</body></html>",
});

/** Document around every page. Route heads (title, description, links, scripts) merge over the defaults. */
const document: DocumentShell = (input) => (frameIdOf(input.url.pathname) ? frameDocument(input) : siteDocument(input));

/** `;` + the stub for this build's docs page script (none in the browser bundle / unbuilt). */
const pageStub = () => {
  const src = pageScript();
  return src ? ";" + PAGE_STUB(src, pageScriptImports(), pageScriptParts()) : "";
};

/** The page's own script (`docsSite({ scripts })`), low priority: a High module script started before first paint counts as render-blocking in Lighthouse's simulation. */
const routeScriptTag = (nonce: string | undefined, pathname: string) => {
  const own = routeScript(pathname);
  return own ? `<script type="module" src="${escape(own)}" fetchpriority="low"${nonce === undefined ? "" : ` nonce="${escape(nonce)}"`}></script>` : "";
};

const siteDocument: DocumentShell = ({ head, nonce, styles, managed, url }) => ({
  start:
    `<!doctype html><html lang="en"${pathIn(url.pathname, site.leanPages ?? []) ? " data-lean" : ""}>` +
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    themeScript(nonce, pageStub(), pathIn(url.pathname, Object.keys(site.frameMeters ?? {}))) +
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
