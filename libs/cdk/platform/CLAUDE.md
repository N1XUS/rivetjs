# @rivetjs/cdk/platform
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Platform and feature detection: Rivet feature probes, React Aria platform checks, Angular CDK `Platform` + feature/shadow-DOM helpers.

## Entry points
- `./platform` -> `index.ts`:
  - Rivet: `supports(feature)` (`"field-sizing"`, `"base-select"`), `_setSupports` (test hook), type `Feature`
  - react-aria: `isMac`, `isIPhone`, `isIPad`, `isIOS`, `isAppleDevice`, `isChrome`, `isWebKit`, `isFirefox`, `isSafari`, `isAndroid`, `isCtrlKeyPressed`, `isVirtualClick`, `isVirtualPointerEvent`
  - Angular CDK: `Platform` (`isBrowser`, `EDGE`, `TRIDENT`, `BLINK`, `WEBKIT`, `IOS`, `FIREFOX`, `ANDROID`, `SAFARI`), `detectPlatform(env)` (pure), `getPlatform()`, `supportsPassiveEventListeners`, `normalizePassiveListenerOptions`, `supportsScrollBehavior`, `RtlScrollAxisType`, `getRtlScrollAxisType`, `getSupportedInputTypes`, `_supportsShadowDom`, `_getShadowRoot`, `_getFocusedElementPierceShadowDom`, `_getEventTarget`, `_isTestEnvironment`, `_resetPlatformMemo`

## Layout
- `index.ts` - single file, sections: features, react-aria checks (`:34`), Angular CDK Platform (`:108`), feature support + shadow DOM
- consumers: `../utils/dom.ts`, `../utils/links.tsx`, many widgets
- tests: `tests/cdk.test.ts` (server probes undefined), `tests/utilities.test.ts` "Platform" (`detectPlatform` UAs), `tests/browser/utilities.test.ts` "platform (browser)" (Chromium flags, shadow DOM helpers), `tests/browser/text-field.test.ts` (imports `/platform/index.ts`)
- docs examples: `apps/cdk-docs/examples/{platform-checks,platform-detect,platform-modifier}/`

## Upstream
- angular/components `src/cdk/platform` (MIT): Platform, features (passive listeners, scroll behavior, RTL scroll axis, input types, shadow DOM), test-environment
- react-spectrum `packages/react-aria/src/utils/{platform,isVirtualEvent}.ts` + `shadowdom/DOMFunctions.ts` (Apache-2.0)
- header deviations: lazy (nothing at import), memoized where upstream memoizes; react-aria checks wrapped in `cached()` like upstream (`/* @__PURE__ */`), first browser answer kept, server `undefined` never cached (M6-PARITY: `testUserAgent` was ~3.4 ms of a 4× first click on `/list-data-1000`)

## Rules / invariants
- server: Rivet/react-aria probes (`supports`, `isMac`, ...) return `undefined`; Angular `getPlatform()` flags `false` - never branch markup on the user agent (HTML cached and shared)
- browser detection keyed on `document`, not `navigator` (Node has a global `navigator`) (`index.ts:37`)
- `isWebKit` / Angular `WEBKIT` exclude Blink/EdgeHTML/Trident (standalone)
- `getSupportedInputTypes`: `color` probed first (Chrome warns otherwise) (`index.ts:265`)
- new progressive features: add to `Feature` + `detect` map (CSS.supports), memoized
- package-wide rules: [../CLAUDE.md](../CLAUDE.md)

## Commands
- `npx vitest run --project cdk libs/cdk/tests/cdk.test.ts libs/cdk/tests/utilities.test.ts libs/cdk/tests/browser/utilities.test.ts`

## Gotchas
- `../interactions/utils.ts:81-88` re-implements `isMac`/`isIOS`/`isWebKit`... returning `boolean` (no server `undefined`); keep both in sync or dedupe
- `_getFocusedElementPierceShadowDom` also in `../a11y/focus-trap.ts:20`

## See also
- [../CLAUDE.md](../CLAUDE.md), [../utils/CLAUDE.md](../utils/CLAUDE.md), [../interactions/CLAUDE.md](../interactions/CLAUDE.md)
- `apps/cdk-docs/content/foundations/platform.md`
