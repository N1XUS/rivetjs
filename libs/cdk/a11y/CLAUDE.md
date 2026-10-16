# @rivetjs/cdk/a11y
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Accessibility services: Rivet helpers (`index.ts`) + Angular CDK a11y ports (focus monitor, focus trap, key managers, live announcer, high contrast, aria describer, interactivity checker).

## Entry points
- `./a11y` -> `index.ts` (Rivet): `visuallyHidden` (inline style object), `hideVisually(el)`, `announce(message, politeness="polite")`, `clearAnnouncements()`, `isVisible`, `isFocusable`, `isTabbable`, `tabbables(root)`, type `Politeness`
- `./a11y/focus-monitor` -> `focus-monitor.ts`: `FocusMonitor`, `getFocusMonitor()`, `InputModalityDetector`, `getInputModalityDetector()`, `isFakeMousedownFromScreenReader`, `isFakeTouchstartFromScreenReader`, `FocusMonitorDetectionMode`, `TOUCH_BUFFER_MS`, `INPUT_MODALITY_DETECTOR_DEFAULT_OPTIONS`, types `FocusOrigin`, `InputModality`
- `./a11y/focus-trap` -> `focus-trap.ts`: `FocusTrap`, `FocusTrapFactory`, `CdkTrapFocus`, `ConfigurableFocusTrap`, `ConfigurableFocusTrapFactory`, `FocusTrapManager`, `getFocusTrapManager()`, `EventListenerFocusTrapInertStrategy`, `_getFocusedElementPierceShadowDom`
- `./a11y/key-manager` -> `key-manager.ts`: `ListKeyManager`, `ActiveDescendantKeyManager`, `FocusKeyManager`, `Typeahead`, `Subject`, `hasModifierKey`, `elementOption(el)`, types `Highlightable`, `FocusableOption`, `ListKeyManagerOption`
- `./a11y/live-announcer` -> `live-announcer.ts`: `LiveAnnouncer`, `getLiveAnnouncer()`, `CdkAriaLive`, type `AriaLivePoliteness`
- `./a11y/high-contrast` -> `high-contrast.ts`: `HighContrastModeDetector`, `getHighContrastModeDetector()`, `HighContrastMode`, `*_CSS_CLASS` constants
- `./a11y/aria-describer` -> `aria-describer.ts`: `AriaDescriber`, `getAriaDescriber()`, `addAriaReferencedId`, `removeAriaReferencedId`, `getAriaReferenceIds`, `CDK_DESCRIBEDBY_*`
- `./a11y/interactivity-checker` -> `interactivity-checker.ts`: `InteractivityChecker`, `IsFocusableConfig`, `getInteractivityChecker()`

## Layout
- `index.ts` - Rivet helpers; regions shared with `<Announcer/>` (`../announcer/index.tsx`)
- one file per Angular CDK service (above)
- tests: `tests/a11y-aria-describer.test.ts`, `a11y-focus-trap-node.test.ts` (+ InteractivityChecker), `a11y-high-contrast.test.ts`, `a11y-input-modality.test.ts`, `a11y-key-manager.test.ts`, `a11y-live-announcer.test.ts`; `tests/portal-resume.test.ts` (rewrites `a11y/index.ts`); `tests/browser/smoke.test.ts` (Announcer markup)
- docs examples: `apps/cdk-docs/examples/{a11y-checks,announce-basic,focus-monitor,focus-trap*,interactivity-checker,key-manager-focus,keyboard-navigation-focus-key-manager,live-announcer-cdk}/`

## Upstream
- angular/components `src/cdk/a11y`: focus-monitor, input-modality, fake-event-detection, focus-trap (incl. configurable + inert strategy), key-manager (list / active-descendant / focus + typeahead), live-announcer (+ cdkAriaLive), high-contrast-mode-detector, aria-describer + aria-reference, interactivity-checker (MIT)
- Deviations (headers): no DI / NgZone / RxJS - plain classes + lazily created shared instances (`getX()`), minimal `Subject` (`subscribe` -> `{ unsubscribe }`); focus-trap: constructors take element (+ checker / document), `CdkTrapFocus` = class (`attach()` after mount, `destroy()` on unmount), "when ready" = next animation frame, anchors also get `hideVisually`; key-manager: items = array or accessor/signal (tracked by an effect); live-announcer: options replace tokens, text-only messages (no `SafeHtml`), modal lookup also covers `[data-rv-overlay][aria-modal]` + `[data-rv-top-layer]`; high-contrast: `(forced-colors: active)` matchMedia instead of BreakpointObserver, server -> NONE; aria-describer: APP_ID -> `appId` ctor arg; interactivity-checker: platform checks follow Angular `Platform`, server `isTabbable` false
- `index.ts` is Rivet-own (`visuallyHidden` mirrors react-aria `useVisuallyHidden`)

## Rules / invariants
- all service files are browser only: create instances in handlers / client effects, never at import or in server render
- resumed key-manager widgets keep the active index in a signal: `updateActiveItem(index())` before `onKeydown`, write back from `change` (`key-manager.ts` header)
- Angular class names kept (`cdk-focused`, `cdk-{origin}-focused`, `cdk-visually-hidden`, `cdk-focus-trap-anchor`, `cdk-live-announcer-element`, `cdk-describedby-message-container`, `cdk-high-contrast-*`); markers `cdkFocusRegionStart/End`, `cdkFocusInitial` (+ deprecated `cdk-focus-*` spellings, `focus-trap.ts:124`)
- `announce()` (index.ts): uses `[data-rv-announcer=polite|assertive]` regions from `<Announcer/>` if present, else creates them (assertive gets `role="alert"`); clears then writes after 50 ms so repeats re-announce
- `visuallyHidden` is inline on purpose (no stylesheet, a class can't break it); frozen (`Object.freeze`): runtime `_applyStyle` caches the cssText of a frozen style object and writes it in one `cssText` set on an element without inline style
- inert strategy never pulls focus back from `div.cdk-overlay-pane` / `[data-rv-top-layer]` (`focus-trap.ts:358`)
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/a11y-aria-describer.test.ts libs/cdk/tests/a11y-focus-trap-node.test.ts libs/cdk/tests/a11y-high-contrast.test.ts libs/cdk/tests/a11y-input-modality.test.ts libs/cdk/tests/a11y-key-manager.test.ts libs/cdk/tests/a11y-live-announcer.test.ts`

## Gotchas
- not ported: cdkMonitorElementFocus / cdkMonitorSubtreeFocus directives, TreeKeyManager
- `FocusMonitor` class has no test (only `InputModalityDetector`; `a11y-key-manager.test.ts` imports the `FocusOrigin` type)
- two `announce` APIs: this one (Angular style, single message, polite default) vs `@rivetjs/cdk/live-announcer` (react-aria, `role="log"`, assertive default) - different regions (`<Announcer/>` vs `<LiveAnnouncerRegions/>`)
- `isFocusable`/`isTabbable` here (Rivet selector helper) differ from `../interactions/utils.ts` (RA selectors) and `InteractivityChecker` (Angular) - kept apart on purpose, different upstream semantics; `tabbables()` ignores positive tabindex order (`index.ts:97`)
- `_getFocusedElementPierceShadowDom` duplicated (`focus-trap.ts:20`, `../platform/index.ts:326`)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../announcer/CLAUDE.md](../announcer/CLAUDE.md), [../focus/CLAUDE.md](../focus/CLAUDE.md), [../keys/CLAUDE.md](../keys/CLAUDE.md)
- `apps/cdk-docs/content/foundations/{a11y-services,announcements,focus-monitor,focus-trap,key-manager,keyboard-navigation}.md`
