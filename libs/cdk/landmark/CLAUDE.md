# @rivetjs/cdk/landmark
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Port of @react-aria/landmark (useLandmark.ts): F6 / Shift+F6 / Alt+F6 landmark navigation, LandmarkController.

## Entry points
- `@rivetjs/cdk/landmark` → `index.tsx`: `landmarkProps(props, ref)` (RA `useLandmark` → its `landmarkProps` bag; `tabIndex` accessor; `aria-label` string or accessor), re-exports `UNSTABLE_createLandmarkController`, types `AriaLandmarkRole`, `AriaLandmarkProps`, `LandmarkProps`, `LandmarkAria`, `LandmarkController`, `LandmarkControllerOptions`
- `manager.ts` (no own export entry; deep import): `LandmarkManager`, `registerLandmark` (internal), `UNSTABLE_createLandmarkController`, types

## Layout
- `index.tsx` only holds `landmarkProps`: registration via resumable `clientEffect(…, {when: "idle"})`; re-registers on label change
- `manager.ts` — all `document` access (plain `.ts`, not server-rewritten): singleton on `document[Symbol.for("rivet-cdk-landmark-manager")]`, replacement event `rv-landmark-manager-change`, wrap event `react-aria-landmark-navigation` (RA name, public); default focus sets `tabindex=-1` then focuses
- Consumer: `../toast/behaviour.tsx` (region landmark)

## Rules / invariants
- Dev warnings (duplicate roles / labels, >1 main) gated like RA: `globalThis.process?.env?.NODE_ENV !== "production"`
- Separate symbol from React Aria's manager (refs are `ref()` accessors, not React refs)
- Keep `document` out of `index.tsx` (server compile rejects browser globals in `.tsx` render code)

## Tests
- `tests/landmark.browser.test.tsx` (cdk-browser): port of useLandmark.test.tsx (41; 1 skipped: Spectrum ActionGroup / TableView)
- `tests/landmark-ssr.test.ts` (cdk): port of useLandmark.ssr.test.js

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/landmark.browser.test.tsx`
- `npx vitest run --project cdk libs/cdk/tests/landmark-ssr.test.ts`
