// Docs page ↔ example frames (iframes of the docs' own frame pages, `/examples/<id>/frame/`). Inline scripts, all
// static (stable CSP hashes on prerendered pages):
// - PARENT_THEME_BRIDGE (docs-kit document.ts, after the pre-paint theme script): answers a frame's
//   "rivet-docs:theme?" with `{ rivetDocsTheme: "light" | "dark" }` and posts every `<html data-theme>` change to all
//   iframes.
// - PARENT_FRAME_HEIGHT (same script): auto-height frames (`<iframe data-auto-height>`, example `frame.auto`) take the
//   height their page posts (`{ rivetDocsFrameHeight: px }`), clamped to FRAME_HEIGHT_MIN..MAX; only the iframe whose
//   window sent it, every other iframe / sender / message is ignored.
// - FRAME_THEME (docs-kit document.ts, end of a frame page's head): sets the `dark` / `light` class + `data-theme` on
//   the example's `<html>` (the @rivetjs/ui / HeroUI selectors) from the parent's word, on every message; starts from
//   the last answer seen (else the system preference); keeps the word: anything that resets those attributes (a dev
//   client re-render, the example's head) is undone at once (MutationObserver), and a page restored from the
//   back / forward cache asks again. Not framed (opened in a new tab): no-op. A frame takes the word only from its parent.
// - FRAME_HEIGHT (same script): posts the frame page's in-flow content height to its parent on every change
//   (ResizeObserver on body + the frame root `[data-rivet-frame]` + its children / grandchildren, DOM changes, load;
//   one measure per animation frame): the bottom of
//   the root (or its last child's margin box) + the body's bottom padding / border / margin, with viewport-tall
//   wrappers (`min-h-dvh` layouts) measured at `min-height: 0` (else the frame grows but never shrinks). Overlays (the
//   cdk overlay layer, positioned outside the root) are not measured, so an open popover never grows the frame.
// - FRAME_JS_METER (frame pages of `DocsSite.frameMeters` only, after FRAME_HEIGHT): posts the JavaScript files the
//   frame page fetched — its own resource timing entries whose path ends in `.js` / `.mjs` (module scripts, dynamic
//   imports, modulepreloads; the inline scripts of its HTML are not files) — to its parent as
//   `{ rivetDocsFrameJs: { files, bytes, cached } }`: once at start (0 files before any input), then on every new file
//   (PerformanceObserver, buffered). `bytes` = `transferSize` (compressed body + headers); a file served from the cache
//   or revalidated (`transferSize` below `encodedBodySize`) counts its `encodedBodySize` (compressed body) and `cached`.
// - PARENT_FRAME_JS_METER (pages of `DocsSite.frameMeters` only, in the head script): writes those numbers into the
//   element whose id the sending iframe names in `data-js-meter` ("JS loaded: 0 B · 0 files",
//   "JS loaded: 56.3 KB · 16 files", "… · 16 files · 1 cached", "… · 16 files · from cache"; KB = 1024 B of `bytes`) and keeps it there (the page's resume adopt run restores server text). A metered iframe written with
//   `data-src` instead of `src` gets its `src` once the page has loaded and painted (first contentful paint), at the
//   next idle period: its requests stay out of the page's first / largest paint.

/** URL path of an example's frame page (a page of the docs app, rendered without the docs chrome). */
export const framePath = (id: string): string => `/examples/${id}/frame/`;
/** The example id of a frame page path (`/examples/<id>/frame/…`), else undefined. */
export const frameIdOf = (pathname: string): string | undefined => /^\/examples\/([^/]+)\/frame(?:\/|$)/.exec(pathname)?.[1];
/**
 * Server app `preload` config for the site's lean pages (`DocsSite.leanPages`): `preload.lean` there — nothing is
 * prefetched before the first interaction (no runtime fetch-ahead); handlers load on intent.
 */
export function pagePreload(lean: readonly string[] = []): { lean: (url: URL) => boolean | undefined } {
  return { lean: (url) => pathIn(url.pathname, lean) || undefined };
}
/** A URL path without its trailing slash (`/` stays): prerender renders `/a/b`, the server `/a/b/`. */
export const pathKey = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, "") : path);
/** Whether `path` is one of `paths`, trailing slashes ignored (site `leanPages`, `frameMeters` keys). */
export const pathIn = (path: string, paths: Iterable<string>): boolean => {
  const key = pathKey(path);
  for (const p of paths) if (pathKey(p) === key) return true;
  return false;
};

/** Message a frame posts to its parent to ask for the theme. */
export const THEME_REQUEST = "rivet-docs:theme?";
/** Auto-height frames: the height range (px) the parent applies. */
export const FRAME_HEIGHT_MIN = 48;
export const FRAME_HEIGHT_MAX = 1600;

/** Parent side (docs pages): theme. */
export const PARENT_THEME_BRIDGE =
  '(function(){var d=document.documentElement;function s(w){w.postMessage({rivetDocsTheme:d.dataset.theme},"*")}' +
  `addEventListener("message",function(e){if(e.data===${JSON.stringify(THEME_REQUEST)}&&e.source)s(e.source)});` +
  'new MutationObserver(function(){for(var f of document.querySelectorAll("iframe"))if(f.contentWindow)s(f.contentWindow)}).observe(d,{attributes:true,attributeFilter:["data-theme"]})})()';

/** Parent side (docs pages): heights of `<iframe data-auto-height>` frames. */
export const PARENT_FRAME_HEIGHT =
  '(function(){addEventListener("message",function(e){var v=e.data&&e.data.rivetDocsFrameHeight;if(typeof v!=="number"||!(v>=0)||!e.source)return;' +
  'for(var f of document.querySelectorAll("iframe[data-auto-height]"))if(f.contentWindow===e.source){' +
  `f.style.height=Math.min(${FRAME_HEIGHT_MAX},Math.max(${FRAME_HEIGHT_MIN},Math.ceil(v)))+"px";break}})})()`;

/** Frame side (frame pages): theme. No inline `color-scheme`: examples styled light-only (bg-white) keep light native controls. */
export const FRAME_THEME =
  '(function(){if(parent===window)return;var d=document.documentElement,k="rivet-docs-theme",t,w;' +
  'function s(){if(!w)return;var x=w==="dark";if(d.dataset.theme!==w)d.dataset.theme=w;if(d.classList.contains("dark")!==x)d.classList.toggle("dark",x);if(d.classList.contains("light")===x)d.classList.toggle("light",!x)}' +
  'function a(v){if(v!=="light"&&v!=="dark")return;w=v;s();try{localStorage.setItem(k,v)}catch(e){}}' +
  "function q(){parent.postMessage(" +
  JSON.stringify(THEME_REQUEST) +
  ',"*")}' +
  'try{t=localStorage.getItem(k)}catch(e){}a(t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));' +
  'new MutationObserver(s).observe(d,{attributes:true,attributeFilter:["class","data-theme"]});' +
  'addEventListener("message",function(e){if(e.source===parent&&e.data&&typeof e.data==="object")a(e.data.rivetDocsTheme)});' +
  'addEventListener("pageshow",function(e){if(e.persisted)q()});q()})()';

/** Frame side (frame pages): content height → parent (applied only to auto-height frames). */
export const FRAME_HEIGHT =
  "(function(){if(parent===window)return;var r=0,h=-1,n,o,u;function px(v){return parseFloat(v)||0}" +
  'function m(){r=0;var b=document.body;if(!b)return;var e=b.querySelector("[data-rivet-frame]")||b,c=e.lastElementChild,y,z,g,l=[],x,i;' +
  "if(e!==n){if(n&&n!==b)o.unobserve(n);o.observe(n=e)}" +
  // Viewport-tall wrappers (`min-h-dvh` / `min-h-screen` / `min-height: 100%`) measured at min-height 0, restored in
  // the same task (no paint): else the frame could grow but never shrink.
  // The root's children and grandchildren are observed too: content shrinking inside such a wrapper resizes no ancestor.
  'for(x of [document.documentElement,b,e].concat([].slice.call(e.querySelectorAll(":scope>*,:scope>*>*")))){if(x.parentElement&&x!==b&&x!==e)o.observe(x);if(px(getComputedStyle(x).minHeight)>=innerHeight-1){' +
  'l.push([x,x.style.getPropertyValue("min-height"),x.style.getPropertyPriority("min-height")]);x.style.setProperty("min-height","0px","important")}}' +
  "y=e.getBoundingClientRect().bottom;" +
  "if(c){g=getComputedStyle(c);if(!/^(absolute|fixed)$/.test(g.position)){z=c.getBoundingClientRect().bottom+px(g.marginBottom);if(z>y)y=z}}" +
  "g=getComputedStyle(b);y+=scrollY+px(g.marginBottom)+(e===b?0:px(g.paddingBottom)+px(g.borderBottomWidth));y=Math.ceil(y);" +
  'for(i of l)i[0].style.setProperty("min-height",i[1],i[2]);' +
  'if(y!==h){h=y;parent.postMessage({rivetDocsFrameHeight:y},"*")}}' +
  "function q(){r||(r=requestAnimationFrame(m))}" +
  "function st(){if(u)return;u=1;o=new ResizeObserver(q);o.observe(document.body);new MutationObserver(q).observe(document.body,{childList:true,subtree:true});q()}" +
  'if(typeof ResizeObserver!=="function")return;if(document.body)st();else addEventListener("DOMContentLoaded",st);addEventListener("load",q);' +
  'addEventListener("pageshow",function(e){if(e.persisted){h=-1;q()}})})()';

/** Frame side (frame pages of `DocsSite.frameMeters`): the JS files this page fetched → parent. */
export const FRAME_JS_METER =
  '(function(){if(parent===window||typeof PerformanceObserver!=="function")return;var s={};' +
  "function p(){var n=0,b=0,c=0,k,r;for(k in s){r=s[k];n++;if(r.transferSize>0&&r.transferSize>=r.encodedBodySize)b+=r.transferSize;else{b+=r.encodedBodySize;c++}}" +
  'parent.postMessage({rivetDocsFrameJs:{files:n,bytes:b,cached:c}},"*")}' +
  "try{new PerformanceObserver(function(l){var x=0;for(var r of l.getEntries())if(!s[r.name]&&/\\.m?js$/.test(new URL(r.name).pathname)){s[r.name]=r;x=1}if(x)p()})" +
  '.observe({type:"resource",buffered:true})}catch(e){}p();addEventListener("pageshow",function(e){if(e.persisted)p()})})()';

/**
 * Parent side (pages of `DocsSite.frameMeters`): a metered frame's JS numbers → the element its `data-js-meter` names.
 * The text is kept: the page's resume adopt run (the first intent on the page) restores its server text ("0 B") in a
 * boundary's region, so a MutationObserver puts the last numbers back.
 */
export const PARENT_FRAME_JS_METER =
  '(function(){addEventListener("message",function(e){var v=e.data&&e.data.rivetDocsFrameJs,f,o,b,n,c;if(!v||typeof v.files!=="number"||!e.source)return;' +
  'for(f of document.querySelectorAll("iframe[data-js-meter]"))if(f.contentWindow===e.source){o=document.getElementById(f.getAttribute("data-js-meter"));if(!o)return;' +
  'b=+v.bytes||0;n=v.files;c=+v.cached||0;o.__rvJs="JS loaded: "+(b<1024?b+" B":(b/1024).toFixed(1)+" KB")+" · "+n+(n===1?" file":" files")+(c?c===n?" · from cache":" · "+c+" cached":"");' +
  "if(!o.__rvJsKeep)new MutationObserver(o.__rvJsKeep=function(){if(o.textContent!==o.__rvJs)o.textContent=o.__rvJs}).observe(o,{childList:true,characterData:true,subtree:true});" +
  "o.__rvJsKeep();return}});" +
  // Deferred metered frames (`<iframe data-js-meter data-src>`): src once the page has loaded AND painted, at the next
  // idle period, so the frame's document and styles never compete with the page's first / largest paint (Lighthouse
  // mobile: FCP 1,354 → 1,505 ms when loaded with the page, eager or `loading="lazy"` alike — the shot is near the fold;
  // `load` alone is not enough: a static page's load can come before its first paint).
  'var k=2;function L(){if(--k)return;(window.requestIdleCallback||setTimeout)(function(){for(var f of document.querySelectorAll("iframe[data-js-meter][data-src]")){f.src=f.getAttribute("data-src");f.removeAttribute("data-src")}},{timeout:1e3})}' +
  'document.readyState==="complete"?L():addEventListener("load",L,{once:true});' +
  'try{if(PerformanceObserver.supportedEntryTypes.indexOf("paint")<0)throw 0;new PerformanceObserver(function(l,o){if(l.getEntriesByName("first-contentful-paint").length){o.disconnect();L()}}).observe({type:"paint",buffered:true})}catch(e){L()}})()';

/**
 * Dev server (`vite.ts` `docsFrames`, the frame branch of `.rivet/entry.dev.tsx`): whether a hot update concerns a frame page: the example's files, its generated frame module / stylesheet, libraries
 * (`libs/`, `node_modules/`) other than the docs-kit chrome. Docs content, nav, layouts and the router's generated
 * app are not in a frame's graph. Vite sends every client every update: a frame must not client-render (and reset)
 * on another page's.
 */
export function frameUpdate(path: string): boolean {
  if (/\/libs\/docs-kit\//.test(path)) return /\/libs\/docs-kit\/(?:components\/frame[\w-]*\.tsx|frame-theme\.ts)/.test(path);
  return /\/examples\/|\/example-frames|\/example-css\/|\/libs\/|\/node_modules\//.test(path);
}
