# `@rivetjs/mobile` — Ionic alternative — design (2026-10-12)

- **Priority: later (user 2026-10-12: "mobile framework is not the priority").** No implementation scheduled.
- Status: **design only (lane MOBILE), parked.** Plan: [`../plans/2026-10-12-mobile.md`](../plans/2026-10-12-mobile.md). Open questions Q1–Q4 (§10): ask the user at GO.
- User directive (2026-10-12, verbatim): "major gap we are not filling: ionic alternative".
- Goal: one Rivet codebase → mobile web, installable PWA, and iOS / Android apps through a Capacitor native shell; native-feeling app chrome (stacks, tabs, sheets, gestures, ios / md modes); prerendered + resumed screens instead of a hydrated SPA.
- Not a goal (v1): a native renderer (NativeScript / React Native class), our own native shell, Cordova, desktop shells (Electron / Tauri: works as "web", not designed for), porting Ionic source (clean-room: public docs + behaviour only; Ionic is MIT, but we build on cdk / ui / motion, not on Stencil web components).
- Inputs: root `CLAUDE.md`; `libs/{router,router/client,router/adapters,runtime,cdk,cdk/sheet-motion,ui,kit,motion}/CLAUDE.md`; `templates/CLAUDE.md`, `libs/create-rivet/CLAUDE.md`; `apps/{ssr,dom}-bench/CLAUDE.md`; `docs/guides/resumability.md`; specs `2026-10-11-{motion,ui-identity,framework-bridges}-design.md`.

## 1. Research (in-app browser, read 2026-10-12)

### 1.1 Versions + licenses (unpkg `package.json`)

| Package | Version | License | Notes |
| --- | --- | --- | --- |
| `@ionic/core` | 9.0.7 | MIT | Stencil 4 web components (`@stencil/core` ^4.44, `ionicons` ^8.1); `@ionic/react` / `/angular` / `/vue` wrappers |
| `@capacitor/core` | 8.5.3 | MIT | docs "Version: v8"; official plugins track `latest-8` npm tags |
| `framework7` | 9.2.0 | MIT | own router + views; ios / md / aurora themes |
| `konsta` | 5.5.0 | MIT | "Mobile UI components made with Tailwind CSS"; React / Vue / Svelte; ios + material; no router |
| `quasar` | 2.35.0 | MIT | Vue; Capacitor / Cordova / Electron / PWA build modes in Quasar CLI |
| `onsenui` | 2.12.9 | Apache-2.0 | site behind a bot check (not read; no bypass) — version only |
| NativeScript | — | — | native renderer (not web DOM): noted, out of scope |

### 1.2 Ionic Framework (what users expect from "an Ionic")

- Components (docs index): Accordion, Action Sheet, Alert, Badge, Breadcrumbs, Button, Card, Checkbox, Chip, Content, Date & Time Pickers, FAB, Grid, Icons, Infinite Scroll, Inputs, Item (swipe / delete / reorder), List, Media, Menu, Modal, Navigation, Popover, Progress, Radio, Range, Refresher, Reorder, Routing, Searchbar, Segment, Select, Tabs, Toast, Toggle, Toolbar, Typography.
- Modes: `ios` / `md`. Platform → mode: iPhone / iPad → `ios`; Android → `md`; everything else ("core") → `md`. `<html class="md" mode="md">`; override globally (`window.Ionic.config.mode`) or per component (`mode` prop). Platform ≠ mode. Global config is **not reactive**.
- Theming: CSS variables (`--ion-background-color`, stepped colours), overridable per mode (`.ios { … }`); app variables `--ion-safe-area-{top,right,bottom,left}`, `--ion-statusbar-padding`, `--ion-padding`, `--ion-font-family`.
- Navigation: `IonRouterOutlet` = framework router + **stacked navigation + animated views**; keeps the previous page's state intact (list → detail → back shows the list as left). Lifecycle `ionViewWillEnter` / `DidEnter` / `WillLeave` / `DidLeave`. `swipeGesture` default **on for ios, off for md**. Custom `animation` builder. Links take `routerDirection` (`forward` / `back` / `root`).
- Ionic React 9 uses React Router (`element=` routes, `/*` nested outlets, `ionPage` on nested outlets). Tabs = non-linear routing: each tab has its own stack; `navigate(-1)` is wrong across tabs (back goes to the tab's previous page, not the previous history entry).
- Header: `translucent` (ios, `backdrop-filter`, content `fullscreen` scrolls behind); `collapse="condense"`: two headers, the in-content large title collapses into the toolbar title on scroll (ios only).
- Modal: inline (`isOpen`, one-way) or controller; `canDismiss` (bool / async fn; fn interrupts swipe); **card** modal on ios (`presentingElement` scales the page behind); **sheet**: `breakpoints` (e.g. `[0, .5, 1]`, 0 = dismiss by swipe), `initialBreakpoint`, `backdropBreakpoint` (background interactive below it), `--height` for auto height, `handleBehavior`, `expandToScroll` (default: content scrolls only when fully expanded).
- Item sliding: options `side="end"` (default, swipe end → start, RTL-aware) / `start`; two option sets max; expandable options (full swipe triggers).
- Refresher: `pullFactor`, `pullMin`, `pullMax`, `complete()`; **native refreshers** by default (ios: relies on rubber-band scroll, tick marks; md: circular spinner); virtual scroll needs the scroll container named.
- Virtual scroll: `ion-virtual-scroll` **removed in v7**; docs recommend third-party `react-virtuoso`. (Our cdk `virtualizer` + `scrolling` are first-party: gap we fill.)
- Gestures: `createGesture({ el, threshold 10, direction 'x', gesturePriority, passive true, maxAngle 40, blurOnStart, onStart / onMove / onEnd })`; priority resolves collisions (swipe-back vs sliding item vs sheet).
- Keyboard: `inputmode`, `enterkeyhint`; `ionKeyboardDidShow { keyboardHeight }` / `DidHide` on window, from Capacitor Keyboard plugin natively or Visual Viewport on the web (Chrome 62+, iOS Safari 13+).
- Hardware back button (Android): priority-ordered handlers (overlay close > menu > stack pop > exit app).

### 1.3 Capacitor 8

- `capacitor.config.ts`: `appId`, `appName`, `webDir` (must contain the final `index.html`), `server.{hostname (localhost), iosScheme (capacitor), androidScheme, url, cleartext}`, `plugins.<Name>`.
- Android: custom schemes "unable to change the URL path as of WebView 117" → keep `https`; routing in a local scheme falls back to the start document for extension-less paths (assumption to verify in T1: `/about` serves `index.html`, not `about/index.html`).
- Live reload: dev server bound to `0.0.0.0`, `server.url = http://<LAN IP>:<port>`, `cleartext: true`, `npx cap copy`, run from Xcode / Android Studio (or `npx cap run ios --live-reload --host …`); never commit `server.url`.
- Official plugins: Action Sheet, App, App Launcher, Background Runner, Barcode Scanner, Browser, Camera, Clipboard, Device, Dialog, Filesystem, Geolocation, Haptics, Http, InAppBrowser, Keyboard, Local Notifications, Motion, Network, Preferences, Privacy Screen, Push Notifications, Screen Orientation, Screen Reader, Share, Splash Screen, Status Bar, **System Bars** (bundled in `@capacitor/core`), Text Zoom, Toast, …
- **Android 16 (API 36) enforces edge-to-edge**: StatusBar `overlaysWebView` / `backgroundColor` no-ops. SystemBars (core) = modern path: `setStyle`, `hide` / `show`; on Android WebView < 140 `env(safe-area-inset-*)` is wrong → plugin injects `--safe-area-inset-*` CSS vars as fallback (`var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`). → safe areas are mandatory, not optional.
- Keyboard plugin: events `keyboardWillShow` / `DidShow` (`keyboardHeight`) / `WillHide` / `DidHide`; config `resize` (`native` default / `body` / `ionic` / `none`, iOS), `style`, `resizeOnFullScreen` (Android full-screen bug workaround), `autoBackdropColor` (8.0.4+).
- Android predictive back: system back animations for opted-in apps (Android 15+); the web layer only sees the App `backButton` event (no progress) → our swipe-back stays an ios-mode edge gesture (§4.3).

### 1.4 Framework7, Konsta, Quasar

- Framework7 View: `preloadPreviousPage` (true; required for swipe back), `restoreScrollTopOnBack` (true), `iosSwipeBack` (true) / `mdSwipeBack` (false), `iosSwipeBackActiveArea` **30 px**, `…Threshold` 0, `…AnimateShadow` / `…AnimateOpacity` (perf toggles), `browserHistory` (off for Capacitor; hash mode for web), per-tab views (`initRouterOnTabShow`).
- Konsta: Tailwind-only styled ios / material components, no router / gestures / native layer → closest to "ui mode tokens", proves Tailwind + modes is enough for the look.
- Quasar: one Vue app, build modes (SPA / SSR / PWA / Capacitor / Cordova / Electron) from one CLI → our `--target app` mirrors its Capacitor mode.

### 1.5 PWA + HIG essentials

- PWA: manifest (`name`, `icons`, `start_url`, `display: standalone`, `theme_color`, `description` + `screenshots` → richer Chrome Android install dialog), service worker for offline, `beforeinstallprompt` (Chromium only; `preventDefault`, keep the event, `prompt()` from own UI); `theme-color` meta beats manifest `theme_color`.
- Apple HIG: tab bar = navigation, not actions; always visible except under a modal; preserves each section's navigation state; avoid overflow ("More"); never hide / disable tabs; labels under icons. Sheets: modal or nonmodal on iOS (nonmodal = affect parent while open), Cancel / Done buttons, Back only for multi-step, not for dismiss; detents (medium / large). 44 pt minimum targets; large titles collapse into the bar.
- Web platform: View Transitions (same-document: Chromium, Safari 18+; cross-document: Chromium 126+, Safari 18.2+) are snapshot-based (not gesture-scrubbable); VirtualKeyboard API is Chromium-only experimental → Visual Viewport is the portable keyboard signal.

## 2. Positioning

- **Rivet Mobile: web-standard mobile apps that start like native.** PWA + Capacitor shell, one codebase (web, iOS, Android), screens prerendered to HTML and resumed (no hydration), fine-grained signal updates for 60 / 120 fps lists and gestures.
- Must match (parity floor): ios / md modes; stack navigation with state preservation + swipe back; tabs with per-tab stacks; sheets with breakpoints; action sheet / alert / toast / picker; sliding items; refresher; infinite + virtual lists; safe areas; keyboard handling; hardware back; theming via CSS variables; dark mode; Capacitor plugins wired.
- Beat (claims we must prove in `apps/mobile-bench`, §7):
  1. **Startup**: first screen is prerendered HTML in `webDir`, paints before any JS executes, resumes on first touch. Ionic React / Angular / Vue starters ship a client-rendered SPA: runtime + framework + Stencil components must parse + render before first paint.
  2. **Bytes per screen**: pay per component (cdk / ui subpaths), mode CSS only for components used; Ionic loads its core + lazy component chunks + framework.
  3. **List perf**: first-party virtualizer + fine-grained row updates; Ionic has no virtual scroll since v7.
  4. **Gesture frame budget**: house motion (embla physics) on transforms, no framework render per frame.
- Skip in v1 (§10 Q2 to confirm): Reorder in lists (cdk drag-drop covers it later), card-modal "presenting element" scale on ios (v1.1), ripple effect for md (CSS-only press state instead), Ionic's `animation` builder API (custom transitions via CSS vars + `transition` prop), Cordova, Capacitor plugins beyond §6.1 (users import them directly), web-component output.

## 3. Package shape

### 3.1 Decision: new lib `libs/mobile` = `@rivetjs/mobile` (not `@rivetjs/ui/mobile`)

| Criterion | `@rivetjs/mobile` | `@rivetjs/ui/mobile` |
| --- | --- | --- |
| App bytes | identical: both are per-subpath, `sideEffects: false`; an untouched subpath = 0 B either way | identical |
| Deps | optional peers `@capacitor/*` (8.x), `workbox`-free SW generator, Vite plugin (`/vite`), build-target code — none belong in a UI kit | ui would gain native + build peers; ui-identity scope (R3: HeroUI family) gets muddied |
| DX | one import root for app chrome: `@rivetjs/mobile/stack`, `/tabs`, `/native/haptics`, `/vite`; docs section "Mobile apps" maps 1:1 | mobile chrome scattered between `ui/*` and a native package anyway |
| Styling | layers mode tokens on the ui theme; reuses ui components (Button, Switch, Slider, Toast, Sheet) by import | same |
| Ownership | separate CLAUDE.md, tests, size lines, zero-cost hashes | one more 179-line CLAUDE.md to grow |

- Layering: `@rivetjs/mobile` → `@rivetjs/ui` (styled parts reused) → `@rivetjs/cdk` (headless) → `@rivetjs/motion` (only `Presence` / `animate` where a page uses them) + `@rivetjs/kit` (head, `Transition`, `Icon`) + `@rivetjs/router/client`.
- Headless behaviour that is not mobile-chrome-specific goes to **cdk** (rule: cdk = behaviour, mobile = styled chrome + app integration): `cdk/nav-stack`, `cdk/swipe-back`, `cdk/item-swipe`, `cdk/pull-refresh`, `cdk/infinite-scroll`, `cdk/keyboard-inset`, `cdk/large-title`, plus extensions of `cdk/sheet-motion` (detent semantics) and `cdk/sidebar` (edge-swipe open). All Rivet-authored (no upstream port) on `cdk/motion`; feature sets inspired by Ionic / Framework7 public docs, independent implementations (clean-room; `NOTICE` names no copied code).
- Source package (`"rivet": { "source": true }`) like cdk / ui: `.tsx` compiled by the app build.

### 3.2 Subpaths (one per component / feature; no barrel)

`./app` (App, Page, Header, Toolbar, Title, Content, Footer), `./stack` (Stack outlet, BackButton, `useStack`), `./tabs` (Tabs, TabBar, TabButton), `./list` (List, Item, ItemGroup, ItemDivider, ItemSliding, ItemOptions, ItemOption), `./sheet` (Sheet with detents, re-styled ui Sheet), `./action-sheet`, `./alert`, `./toast`, `./picker` (Picker, DatetimeWheel), `./segment`, `./searchbar`, `./fab`, `./refresher`, `./infinite-scroll`, `./virtual-list`, `./skeleton`, `./badge`, `./chip`, `./toggle`, `./range`, `./textarea`, `./input`, `./menu`, `./split-pane`, `./mode` (mode detection, `ModeScript`, `useMode`), `./styles` (CSS: tokens + per-component CSS split, same split as ui-identity §3.4), `./native` + `./native/<plugin>` (§6), `./vite` (`mobile()` plugin: PWA manifest, SW, app target), `./sw` (service worker runtime, built into `sw.js`).

### 3.3 Platform modes

- Values `ios` | `md`. Default detection (Ionic parity): iPhone / iPad / iPod (incl. iPadOS desktop UA: `MacIntel` + `maxTouchPoints > 1`) → `ios`; Android → `md`; everything else → `md`; Capacitor native → `Capacitor.getPlatform()`.
- **Markup is mode-independent.** Server / prerender emits the same HTML for both modes; mode = `data-mode` on `<html>` + CSS + behaviour flags read at runtime (swipe-back on / off, transition kind, refresher style). Reason: one prerendered `webDir` serves iOS + Android + web; resume state never differs per mode; no hydration mismatch class of bugs.
- `ModeScript` (like kit `ThemeScript`): static inline head script (stable CSP hash) sets `data-mode` before first paint; override order: `?mode=` (dev only) > `localStorage["rivet:mode"]` (dev only) > `<App mode>` / `mobile({ mode })` (forced) > detection. Forced mode at build (`mobile({ mode: "ios" })` or `--platform ios`) bakes the attribute into the HTML and drops the script.
- `useMode()` = signal (reads the attribute once; dev toggle can flip it → live CSS + flags). Per-component `mode` prop overrides (`data-mode` on the element); live prop.

### 3.4 Tokens + CSS

- Base = ui `rivet` theme (ui-identity R3 / R6: HeroUI look, brand accent). Mobile layer = `@layer rivet-mobile` after ui, **tweaks only**, keyed `:root[data-mode=ios]` / `[data-mode=md]`.
- Mode token table (initial values from the platforms' public guidelines; final numbers measured against iOS Simulator + Android emulator screenshots in T2):

| Token | ios | md |
| --- | --- | --- |
| `--m-font` | `-apple-system, system-ui` | `Roboto, system-ui` |
| `--m-toolbar-h` | 44 px | 56 px (64 px ≥ 600 px wide) |
| `--m-tabbar-h` | 49 px (+ safe bottom) | 80 px (M3 navigation bar) |
| `--m-title-large` | 34 px / 700 | — (no large title; md uses 22 px top app bar title) |
| `--m-item-min-h` | 44 px | 48 px (56 two-line) |
| `--m-list-inset` | inset-grouped radius 10 px | full-bleed, dividers |
| `--m-push-ease` / `--m-push-ms` | spring-like `cubic-bezier(.32,.72,0,1)` 500 ms | `cubic-bezier(.2,0,0,1)` 300 ms (fade-through) |
| `--m-press` | opacity / highlight | state-layer tint (CSS, no ripple JS) |
| `--m-backdrop` | `rgb(0 0 0 / .4)` | `rgb(0 0 0 / .32)` |

- Safe areas everywhere through four tokens: `--m-safe-{top,right,bottom,left}: var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` (Capacitor SystemBars fallback first). Header / TabBar / Footer / Fab / Sheet / Toast / Menu pad with them; `viewport-fit=cover` meta from `App` head (kit `Meta`).
- Touch targets: ≥ 44 px hit area on `pointer: coarse` without changing the visual size (ui-identity principle 7) — Toolbar buttons, TabButton, Item, BackButton.
- Dark mode: ui theme dark tokens + kit `ThemeScript`; Capacitor SystemBars style follows (`native/system-bars` sync helper); `color-scheme` meta + `theme-color` per scheme.
- Viewport units: `100dvh` / `100svh`, never `100vh` (WKWebView); `overscroll-behavior: none` on `html` + the shell (no page rubber-band), `contain` on scrollers; `-webkit-tap-highlight-color: transparent`; `touch-action: manipulation` on controls (no 300 ms / double-tap zoom).

## 4. Components

Columns: upstream reference (behaviour inspiration, public docs) · cdk primitive (existing / new) · gesture / motion engine · SSR / resume (prerendered markup; which chunk loads on first touch; preload) · a11y · size budget (min+br, first-use chunk incl. its new deps; measured in T1 baseline then enforced by `size-report`).

| Component | Upstream ref | cdk primitive | Gesture / motion | SSR / resume | a11y | Budget br |
| --- | --- | --- | --- | --- | --- | --- |
| **App** / **Page** / **Header** / **Toolbar** / **Title** / **Footer** | ion-app/page/header/toolbar/title | `landmark`, kit head | — | pure markup + CSS, 0 B JS (`App` emits `viewport-fit=cover`, `ModeScript`) | `header`/`main`/`footer` landmarks, `h1` title | 0 B JS; CSS ≤ 1.5 KB |
| **Content** (scroll container; scroll-to-top on status-bar tap / tab re-tap; `fullscreen` behind translucent header) | ion-content | `scrolling` (`CdkScrollable`), new `large-title` | native scroll; `scroll` listener `passive` | markup only; scroll handler chunk `visible`; scroll-to-top via `native/status-tap` event | `main`, `tabindex=-1` focus target on page enter | ≤ 0.6 KB |
| **Large title collapse** (ios) | ion-header `collapse="condense"` | new `cdk/large-title` (scroll-driven; `animation-timeline: scroll()` where supported, rAF fallback) | CSS scroll timeline / 1 rAF write per frame | both headers prerendered; md hides by CSS; zero JS where scroll timelines exist (Chromium, Safari 26) | one title announced (`aria-hidden` on the collapsed copy) | ≤ 0.5 KB |
| **Stack** (outlet: push / pop, transitions, kept pages) + **BackButton** | ion-router-outlet, ion-nav, F7 View | new `cdk/nav-stack` (stack model, keep-alive, lifecycle `onEnter` / `onLeave`) | house motion `Motion1D` on `translateX` (2 layers), interruptible | §5; first page resumed; pushed pages client-rendered from the router page chunk + `_data.json`; `Stack` chunk `intent` on any `Link` | focus to page title on enter, restored on back; `aria-hidden` + `inert` on kept pages; announce title (router announcer) | ≤ 3.5 KB |
| **Swipe back** (ios default on, md off) | Ionic `swipeGesture`, F7 `iosSwipeBack*` | new `cdk/swipe-back` on `cdk/motion` (`VelocityTracker`, `DragRelease`) | edge 30 px active area, 10 px threshold, axis lock, velocity projection, commit > 50 % or flick; previous page **live** underneath (kept, not snapshot) | edge `pointerdown` handler must exist before the first swipe → chunk preloaded `eager` when stack depth > 1 (or `idle` at depth 1, §8 R1) | keyboard / SR users use BackButton; `prefers-reduced-motion` → no parallax, crossfade | ≤ 1.8 KB |
| **Tabs** / **TabBar** / **TabButton** (per-tab stacks) | ion-tabs, HIG tab bars | cdk `tabs` (selection model) + `nav-stack` per tab | tab switch = no transition (HIG); re-tap active tab → pop to root, then scroll to top | each tab = route group `(tabs)/<tab>/…`; inactive tabs' stacks kept; TabBar links are `Link`s (`preload="intent"`) | `role=tablist` would be wrong for navigation → `nav` + links with `aria-current="page"` (HIG navigation, not tabpanels) | ≤ 1.2 KB |
| **List** / **Item** / **ItemGroup** / **ItemDivider** | ion-list / ion-item, HIG lists | cdk `grid-list` (interactive) or plain `ul` (static) | press state CSS | markup; interactive rows resume per handler (`For` ≥3 rows → `visible`, ≤ 8 KB) | list semantics; `Link` items; 44 / 48 px targets | 0 B static; ≤ 0.8 KB interactive |
| **ItemSliding** / **ItemOptions** / **ItemOption** (start / end, expandable full swipe) | ion-item-sliding | new `cdk/item-swipe` on `motion` | horizontal drag, axis lock vs vertical scroll, rubber band, snap open / closed, full-swipe commit, one open row per list | options prerendered (clipped); swipe chunk `visible` on first sliding row | options reachable without gesture: row action menu on long-press / ContextMenu key (cdk `morph/item`) + focusable options when open; `aria-describedby` hint | ≤ 1.6 KB |
| **Sheet** (detents / breakpoints, backdropBreakpoint, nonmodal, `expandToScroll`, `canDismiss`) | ion-modal sheet, HIG sheets | cdk `sheet-motion` (snap points, close threshold, backdrop fade **exist**) + overlay layer; add `backdropFrom` interactivity + `expandToScroll` + async `canDismiss` | sheet-motion | closed: render-function children (resumability rule); open state resumable; chunk `intent` on trigger | modal: focus trap (`focus-scope`), `aria-modal`; nonmodal: no trap, `dialog` without `aria-modal` | ≤ 3 KB (reuse ui `sheet`) |
| **ActionSheet** | ion-action-sheet, HIG | `sheet-motion` + `menu` semantics | sheet-motion | `intent` on trigger | `menu` / `menuitem`, cancel = Escape / backdrop | ≤ 1 KB over Sheet |
| **Alert** | ion-alert | ui `alert-dialog` | overlay fade + scale (CSS `@starting-style`, motion spec Q1) | `intent` | `alertdialog` | reuse ui |
| **Toast** (top / bottom, safe-area, swipe dismiss) | ion-toast | cdk `toast` (RAC) | swipe-dismiss via `motion` | region prerendered empty; `toast()` call site chunk | live region (exists) | ≤ 0.4 KB over ui toast |
| **Picker** (wheel) / **DatetimeWheel** | ion-picker, ion-datetime wheel | cdk `wheel-picker`, `time-wheels` (**exist**) + date drums | existing wheel physics | inline or in Sheet; chunk `intent` | spinbutton per drum (exists) | reuse cdk |
| **Segment** | ion-segment | cdk `toggle-button-group` / ui `segment` + `selection-indicator` | indicator slide (existing shared-element) | reuse ui | radio-group semantics (exists) | reuse ui |
| **Searchbar** (cancel button ios, clear, `enterkeyhint=search`) | ion-searchbar | cdk `search-field` | — | reuse | `search` landmark | ≤ 0.4 KB |
| **Fab** (+ FabList, edge / safe-area placement) | ion-fab | `button`, `menu` for lists | CSS | markup | label required | ≤ 0.4 KB |
| **Refresher** (pull-to-refresh; native-looking ios ticks / md spinner) | ion-refresher | new `cdk/pull-refresh` | ios: rubber-band overscroll on the scroller (WKWebView native bounce) read via `scrollTop < 0`; md / Chromium: pointer drag + `motion` rubber band; `pullMin` 60 / `pullMax` 120 / `pullFactor` 1 defaults (to tune) | chunk `visible` on Content with a Refresher | status announced ("Refreshing", "Updated"); also a toolbar refresh action for non-gesture users | ≤ 1.4 KB |
| **InfiniteScroll** | ion-infinite-scroll | new `cdk/infinite-scroll` (IntersectionObserver sentinel, `threshold` 15 %, `complete()`, `disabled`) | — | sentinel prerendered; chunk `visible` (observer only) | `aria-busy` on the list, live "Loaded N more" | ≤ 0.5 KB |
| **VirtualList** | (Ionic: none since v7; Virtuoso) | cdk `virtualizer` (RA) / `scrolling` (Angular CDK) **exist** | native scroll | first window prerendered (N rows at the reference height) → resumes; rest client | grid / listbox semantics with `aria-rowcount` / `aria-setsize` | reuse cdk |
| **Skeleton**, **Badge**, **Chip** | ion-skeleton-text / badge / chip | ui (exist) | CSS shimmer (reduced-motion off) | 0 B JS | `aria-busy` region | reuse ui |
| **Toggle** (ios switch look), **Range** (pin, ticks) | ion-toggle, ion-range | ui `switch`, `slider` (free drag + snap, memory `slider-free-drag`) | existing | reuse | exists | mode CSS only |
| **Textarea autogrow**, **Input** | ion-textarea `autoGrow`, ion-input | cdk `text-area` / `text-field` | — | reuse; autogrow = CSS `field-sizing: content` with a JS fallback (Safari < 26) | exists | ≤ 0.3 KB fallback |
| **Keyboard-aware inputs** (scroll into view, inset footer / sheet above keyboard) | Ionic keyboard events | new `cdk/keyboard-inset`: `--m-keyboard-h` CSS var from Capacitor Keyboard (native) or `visualViewport` (web) | — | installed by `App` at `idle`; no-op on desktop | focused field kept visible (`scrollIntoView({ block: "nearest" })` after `keyboardDidShow`) | ≤ 0.6 KB |
| **Menu** (side drawer, edge swipe open, `type` overlay / push / reveal) | ion-menu | cdk `sidebar` (sheet-motion mobile sheet **exists**) + edge-swipe open | sheet-motion | closed: render-function children | `dialog` + focus trap on mobile; `nav` inside | ≤ 1 KB over sidebar |
| **SplitPane** (tablet: menu / list pinned ≥ `when` breakpoint, default 992 px) | ion-split-pane | CSS container / media query + Menu | — | CSS only; mode-independent markup | landmarks | 0 B JS |

- Every prop live unless justified in `libs/mobile/CLAUDE.md` (memory `live-props-default-live`).
- Icons: lucide via `@rivetjs/kit/icon` (back chevron, close, search, refresh …); mode-specific glyph choice (ios `chevron-left` vs md `arrow-left`) = two lucide nodes switched by CSS, never invented SVG.

## 5. Navigation + state model

### 5.1 Router mode for app shells

- `rivetRouter({ mode: "static" })` stays the base: prerendered `dist/client/**/index.html` + `<page>/_data.json` (static data URL) per route; client router navigates via data JSON + lazy page chunks (no document loads inside the app).
- `mobile({ target: "app" })` (Vite plugin from `@rivetjs/mobile/vite`, also `rivet build --target app`):
  - output dir = Capacitor `webDir` (`dist/app`); root `index.html` = start route prerendered + resumed;
  - **start-document fallback**: native local servers return the start document for extension-less paths (T1 verifies). Generated client entry compares `location.pathname` with the resumed page's route; mismatch → immediate client `navigate(location, { replace: true })` before first paint where data is in the bundle (`_data.json` fetch is local, ~ms) — deep links / cold starts on any route work;
  - drops network-only features: document prefetch / Speculation Rules (no network documents), cacheability probe, `prefetch="document"` warnings;
  - `base: "/"`, absolute asset URLs (work under `capacitor://localhost` / `https://localhost`), CSP hash mode kept (no nonce: no server).
- Web / PWA target unchanged (static or server mode); `mobile()` adds manifest + SW (§5.6).

### 5.2 Stack model on top of the file router

- A layout `_layout.tsx` renders `<Stack>` instead of `{children}` → this level becomes a stack. Push = navigation to a deeper / sibling route under the layout with direction `forward`; pop = history back to an entry still in the stack; `root` = reset.
- Direction from history entry index (router `scroll.ts` already keys entries `i`): new `i` > top → forward; `i` in stack → pop to it; else root. `Link direction="forward|back|root"` overrides (Ionic `routerDirection`).
- Kept pages: each stack entry keeps its rendered page (DOM + owner) mounted under the stack (hidden: `inert`, `aria-hidden`, `content-visibility: hidden` except the page directly under the top while a swipe runs). Keep limit `keep={5}` (default, live) → older entries disposed and re-rendered from cached data on pop. Page caching = keep-alive, not snapshots.
- Loader data: each kept page holds its route data; pop shows it immediately, revalidates per existing router `invalidate` / `live` rules.
- Tabs: `(tabs)/_layout.tsx` renders `<Tabs>`; each tab's subtree `_layout.tsx` renders its own `<Stack>`. Tab switch = keep the leaving tab's whole stack; URL = active tab's top entry; back button / hardware back inside a tab pops that tab's stack only (Ionic non-linear routing rule); history `back` across tabs is not used for in-tab back.
- Deep links: route URL → start document → fallback navigate (§5.1) → stack built with the target as root plus `parents` declared by the route (`export const stack = { parent: "/items" }`, optional) so the back button exists on cold deep links (Ionic `defaultHref` equivalent on BackButton too).
- Lifecycle: `onPageEnter` / `onPageLeave` (will / did as an argument) from `@rivetjs/mobile/stack` — owners of kept pages stay alive; effects keep running (opt out with `whenActive(fn)`).

### 5.3 Transitions

- Stack push / pop: own transition on two live layers (house motion `Motion1D`, interruptible, scrub-able by swipe back). ios: incoming `translateX(100% → 0)`, outgoing `0 → -30%` + dim + edge shadow; md: incoming `translateY(8 % → 0)` + opacity (fade-through). Tokens `--m-push-*`; `transition="none" | "ios" | "md" | fn`.
- Why not View Transitions for the stack: snapshots can't be scrubbed by a finger, block input during the transition, and Safari support is recent. VT stays the router default for **non-stack** navigations (router `/transitions`) and for shared-element heroes (`view-transition-name`) where supported; motion's `animateLayout` is the fallback (motion spec D12).
- kit `Transition` for overlays inside pages (existing); `@rivetjs/motion` `Presence` for page-level entrance effects (optional import).
- Reduced motion: crossfade 150 ms, no parallax.

### 5.4 Scroll restoration + focus

- Kept pages keep their scroll position (their Content element is never re-created). Disposed entries restore via router `scroll.ts` history state. Tab switch restores each tab's top page scroll.
- Focus: page title (`h1`, `tabindex=-1`) on enter; on pop, the element that triggered the push (stored per entry), else title. Router announcer reads the title.

### 5.5 Offline data

- `@rivetjs/mobile/storage`: `persisted(signal, key, { storage })` with adapters `local` (localStorage), `idb` (IndexedDB, tiny wrapper), `preferences` (Capacitor Preferences, dynamic import, native only, web fallback `local`). Read happens on the client after resume (server value = default; documented flicker rule: render a skeleton until `ready()`).
- Route data offline: static `_data.json` is precached by the SW (§5.6) and bundled in the app `webDir` → app target is offline by construction for build-time data.
- Dynamic data in apps: loaders run at build time only in static mode; runtime data = client `resource` / `fetch` against the user's API with `cache: "sw"` strategy (stale-while-revalidate through the SW) — no new loader concept in v1 (§10 Q3: client loaders for app target?).

### 5.6 Service worker + manifest (PWA)

- `mobile({ pwa: { name, shortName, themeColor, backgroundColor, icons: "src/icon.png", screenshots?, display: "standalone", startUrl } })`:
  - `manifest.webmanifest` + icon set from one source image (reuse compiler `?image` sharp pipeline; 192 / 512 / maskable) + `<link rel=manifest>` + `theme-color` metas via kit head;
  - `sw.js` generated at build: precache = Vite manifest assets + prerendered HTML + `_data.json` (hash-versioned list), runtime routes: navigations network-first → cache fallback (server mode) / cache-first (static), assets cache-first immutable, `cache: "sw"` API calls stale-while-revalidate; update flow `onUpdate()` signal → "Reload to update" toast; no Workbox dependency (≤ 2 KB br SW, measured);
  - registration script at `idle`, never before first paint; skipped in the app target unless `pwa.inApp: true` (Capacitor serves local files; SW only for runtime API cache).
- Install prompt: `@rivetjs/mobile/install` `installPrompt()` signal (`beforeinstallprompt` captured, `prompt()`), iOS hint component (Share → Add to Home Screen) when `navigator.standalone === false` on iOS.

## 6. Native bridge + tooling

### 6.1 `@rivetjs/mobile/native/*`

- Thin, typed, tree-shakeable adapters; each subpath dynamic-imports its `@capacitor/*` plugin only when `Capacitor.isNativePlatform()` (detected via `globalThis.Capacitor`, no import of `@capacitor/core` on the web path); web fallback otherwise. All optional peers (`@capacitor/core` `>=8.0.0 <9`, plugins `latest-8` ranges).

| Subpath | Native | Web fallback |
| --- | --- | --- |
| `native/system-bars` | `SystemBars.setStyle` / `hide` / `show` (core); `syncSystemBars(theme)` follows dark mode | `theme-color` meta update |
| `native/status-bar` | `@capacitor/status-bar` (legacy, iOS + Android ≤ 15); `statusTap` → scroll-to-top | no-op |
| `native/keyboard` | `@capacitor/keyboard` events → `--m-keyboard-h`, `keyboard()` signal; `hide()` | `visualViewport` resize; `blur()` |
| `native/haptics` | `@capacitor/haptics` impact / notification / selection | `navigator.vibrate` (Android Chrome), else no-op |
| `native/splash` | `@capacitor/splash-screen` `hide()` **after first paint of the resumed shell** (auto, `launchAutoHide: false` documented) | no-op |
| `native/app` | `@capacitor/app`: `backButton` → mobile back stack (priority: overlay > menu > stack pop > `exitApp` at root, configurable), `appUrlOpen` → router `navigate` (deep links), `appStateChange` / `resume` → `invalidate()` option | `popstate`, `visibilitychange` |
| `native/safe-area` | reads SystemBars-injected vars; exposes `safeArea()` signal | `env()` via a probe element |
| `native/preferences` | `@capacitor/preferences` | `localStorage` |

- Hardware back + overlays: cdk overlay layer registers a back handler while open (dismissable overlays close on back, Ionic parity).
- Haptics wired into components behind `haptics` prop (default on in ios mode for Toggle, Picker detent, ItemSliding full-swipe commit, Refresher trigger) — each call site imports `native/haptics` lazily → 0 B until used.

### 6.2 Template, generator, build target

- `templates/starter-mobile` (create-rivet id `mobile`): static mode + `@rivetjs/ui` + `@rivetjs/mobile`, tabs app (Home / Search / Settings) with a list → detail stack, sheet, refresher; `capacitor.config.ts` (`webDir: "dist/app"`), scripts `build` (= `vite build && vite build --ssr && node prerender.js --target app`), `cap:sync`, `cap:ios`, `cap:android`, `dev:device` (Vite `--host` + prints the `server.url` snippet); README: `npx cap add ios`, `npx cap add android`, live reload, Android 16 edge-to-edge note. Native projects (`ios/`, `android/`) are **not** in the template (generated by the user's `cap add`).
- `@rivetjs/nx`: `application --template mobile` + `mobile-setup` generator (adds the dependency set, `mobile()` plugin, `capacitor.config.ts`, targets `cap-sync` / `cap-open-ios` / `cap-open-android`).
- `rivet build --target app` (router bin): runs the three build steps with `mobile({ target: "app" })` forced; prints the `npx cap sync` next step. Size report stages `starter-mobile` (new baseline line).
- Dev on device: `rivet dev --host` + `mobile()` dev middleware prints the LAN URL + QR (dev-only, lazy); HMR over the LAN works (Vite); docs warn never to commit `server.url`.

## 7. Perf plan — `apps/mobile-bench`

- Lanes (same screens, same data, production builds):
  - `rivet-app` (static prerender + resume, `--target app`), `rivet-pwa` (static, SW), `rivet-csr` (router csr: isolates resume's effect);
  - `ionic-react`, `ionic-angular`, `ionic-vue` (official starters `tabs` template, latest 9.x / Capacitor 8; screens ported: tabs + list 10k + detail + sheet); optional `konsta-react`, `framework7` (look-alike baselines, no stack parity for Konsta).
- Screens: S1 tabs shell + 50-row list; S2 detail push; S3 10k-row virtual list; S4 sheet with 3 detents; S5 settings form (toggles, range, picker).
- Metrics (each lane interleaved per sample, bench lock, `verdict.ts` WIN / TIE / LOSE as dom-bench):
  - startup: FCP, LCP, **time to first successful tap** (synthetic tap on a list row → detail visible), long tasks before it, JS bytes executed before first paint;
  - bytes per screen (min / br, eager + on-first-tap), CSS bytes;
  - list scroll: 10k rows, 5 s scripted fling, dropped frames % (CDP `Tracing` frame events), p95 frame time, at 60 and 120 Hz emulation;
  - transitions: push / pop / swipe-back frame drops (pointer-scripted drag), input-to-first-frame;
  - memory: JS heap after GC with 5 kept pages, DOM nodes.
- Environments:
  - Chrome mobile emulation (Moto G Power-class CPU 4× throttle, Fast 4G for PWA lanes, offline for app lanes) — CI-runnable;
  - **iOS Simulator (real WKWebView)** through the session's iOS Simulator tool (`mcp__Claude_Code_iOS_Simulator__*`: launch the Capacitor build, screenshot, scripted swipes / taps): correctness + visual check of ios mode, safe areas, keyboard, rubber-band, swipe back; timings recorded as indicative (Simulator ≠ device CPU). Real-device runs (iPhone + mid-range Android) by the user before any public claim.
- Gates: no claim in docs / homepage without a recorded run (`docs/benchmarks/2026-xx-mobile.md` + `.json`).

## 8. Risks

1. **Gestures vs resume + `_dispatch` batching + first-click defer (R1, top).** The first touch on a resumed page loads handler chunks; a swipe starting before its chunk arrives is lost (loader replays clicks, not pointer streams). Batching through `_dispatch` delays DOM writes inside handlers; the first-mouse-click defer flushes a task later. Mitigation: gesture engines write transforms directly from `pointermove` (outside signal batching, no per-frame signal writes); gesture chunks preloaded `eager` when they are on screen (`clientEvent({ passive: false })` already maps to `eager`) and budgeted ≤ 2 KB each; first-click defer is mouse-only (touch unaffected) — test on touch emulation + Simulator; replay rule: a `pointerdown` that arrived before the chunk starts the gesture from its recorded origin (loader keeps the last pointerdown) — runtime change, measured.
2. **iOS WKWebView quirks (R2).** `100vh` ≠ visible height (use `dvh`), rubber-band overscroll on the body (disable at `html`, keep inside scrollers for the native refresher), keyboard resize modes differ (Capacitor `resize`: `native` shrinks the WebView, `none` overlays) → `keyboard-inset` handles both, Simulator-tested; `position: fixed` inside scrolled containers during keyboard; `backdrop-filter` cost on translucent headers (perf flag); safe-area `env()` wrong on Android WebView < 140 (use SystemBars vars).
3. **Resume vs state preservation across stack pages (R3).** Only the start page resumes; pushed pages render on the client. Kept pages hold owners + effects (memory); resumed components without an own region re-create on first signal change (root gotcha) — a kept resumed page re-creating while hidden loses its scroll / input state. Mitigation: stack entries are owner roots; the start page gets a region root (`_regionState`) when mounted in a Stack; test "resumed start page → push → pop → state intact".
4. **Start-document fallback in native local servers.** If Capacitor serves `index.html` for every route, the resumed markup belongs to `/` while the URL is `/items/5` → wrong first paint for a frame. Mitigation: T1 spike on Simulator + emulator; fallback navigate before paint; or emit per-route `index.html` reachable through `server.appStartPath`. Hash routing as last resort (Framework7 does).
5. **View Transitions support** (Safari 18+, none in older WKWebView): stack doesn't depend on it; VT only for opt-in shared-element effects with motion fallback.
6. **Gesture conflicts** (swipe-back vs ItemSliding vs horizontal Carousel vs Sheet vs browser back-swipe in Safari web): one gesture arbiter in `cdk/motion` (`claim(priority)`: swipe-back 100 > sheet 50 > item-swipe 40 > carousel 30, Ionic `gesturePriority` parity); edge zone excludes item-swipe; Safari web (not standalone) has its own edge back-swipe → our swipe-back off in mobile Safari tabs, on in standalone / Capacitor.
7. **Bundle growth.** Stack + transitions + swipe-back + tabs could reach 8–10 KB br eagerly. Budgets per subpath (§4) enforced in `size-report`; swipe-back + transitions are separate chunks loaded at depth > 1.
8. **Android predictive back / edge-to-edge.** WebView sees only `backButton`; system back animation may conflict with our pop animation → pop without animation when triggered by the system gesture (configurable).
9. **Scope creep vs Ionic's 40+ components.** Reuse ui / cdk first (14 of the rows above already exist); new cdk behaviours limited to 7 modules.

## 9. Docs

- apps/docs new section **"Mobile apps"** (`content/guides/mobile/`): `index.md` (why, architecture diagram: prerendered shell → resume → native shell), `capacitor.md` (setup, `cap add`, sync, live reload, deep links, Android 16 edge-to-edge), `navigation.md` (stacks, tabs, back, deep links, lifecycle, keep-alive), `gestures.md` (swipe back, sliding items, sheets, refresher, priorities, reduced motion), `offline.md` (PWA, SW, storage adapters, `--target app`), `modes-and-theming.md` (ios / md, tokens, safe areas, dark mode), `native.md` (each `native/*` adapter + fallbacks), `performance.md` (bench results, once recorded); `_nav.ts` entry; `best-practices` page "Mobile: keyboard + safe areas"; starter listed in starters (docs-kit generator).
- ui-docs: "Mobile" group, one page per `@rivetjs/mobile` component, every example rendered inside a **device frame** (CSS frame component in docs-kit: notch + home indicator + `--safe-area-inset-*` set to device values, ios / md toggle on the frame); live examples are real routes (stack demos navigate inside the frame via an in-frame router base).
- AI outputs: llms.txt / llms-full / per-page `.md` regenerated (`docs-kit llms --check`), MCP data (`libs/mcp/build-data.ts`: mobile components in the component reference), `libs/mcp/ai` rules (mobile template AGENTS.md / CLAUDE.md) + skills (`rivet-ui-design`: mobile chrome section) synced.
- CLAUDE.md: `libs/mobile/CLAUDE.md` + each new cdk module's CLAUDE.md; root repo map row; templates / create-rivet / nx CLAUDE.md.

## 10. Open questions (ask at GO)

- Q1: package name `@rivetjs/mobile` OK (vs `@rivetjs/app`)? Recommendation: `mobile` (search term users use; "Ionic alternative").
- Q2: v1 skips (§2): Reorder, ios card modal, md ripple, Ionic-style animation builder — confirm.
- Q3: client loaders for the app target (runtime data through a `clientLoad` route export) in v1, or `resource` / `fetch` only?
- Q4: mode look — exact iOS / Material imitation (Konsta-style pixel parity) or "HeroUI base + mode tweaks" (this spec, ui-identity R3)? Recommendation: tweaks only.
