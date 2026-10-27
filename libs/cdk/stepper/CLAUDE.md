# @rivetjs/cdk/stepper
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Angular CDK stepper port (v22.2.2): wizard-like workflow split into steps, linear validation, indicator types, keyboard navigation; accessible markup of Angular Material's stepper. Headless (default `rv-*` classes + `data-*` state). Consumer: `@rivetjs/ui/stepper` (HeroUI-look Stepper, feature set inspired by HeroUI Pro's public docs).

## Entry points
- `@rivetjs/cdk/stepper` -> `index.tsx`: `Stepper`, `StepList`, `Step`, `StepHeader`, `StepLabel`, `StepPanel`, `StepperNext`, `StepperPrevious`, `useStepper`, `useStep`, `StepperContext`, `StepContext`, `*Props` / render-prop types; re-exports `./state.ts`.
- `@rivetjs/cdk/stepper/state` -> `state.ts` (package.json export): `createStepperState(id, props)`, `createStepState`, `registerStep` / `unregisterStep`, readers (`stepperSelectedIndex`, `stepCount`, `stepIndex`, `stepIsSelected`, `stepIsLast`, `stepCompleted`, `stepHasError`, `stepShowError`, `stepEditable`, `stepOptional`, `stepIndicatorType`, `stepIsNavigable`, `stepContentPosition`, `stepperFocusIndex`, `stepLabelId`, `stepContentId`), actions (`selectStep`, `stepperNext`, `stepperPrevious`, `stepReset`, `stepperReset`, `markStepInteracted`, `markVisitedSteps`), keyboard (`stepperHeaders`, `stepperKeys`, `stepperHeaderKeyDown`), types (`StepControl`, `StepState`, `STEP_STATE`, `StepperSelectionEvent`, `StepperSemantics`, `StepperOrientation`).

## Layout
- `state.ts` — plain signals + free functions: selection via cdk `controllable` (value / Signal / accessor), steps list signal, per-step `interacted` / overrides; linear gating = upstream `_anyControlsInvalidOrPending` + `_isValidIndex`.
- `index.tsx` — parts; `Step` registers itself (creation order = index; `onCleanup` unregisters); `StepHeader` owns click / keydown / pointer hover / focus-visible; `StepPanel` `index` or the enclosing `Step`.
- tests: `../tests/stepper-state.test.ts`, `../tests/stepper-ssr.test.ts`, `../tests/stepper.browser.test.tsx` (Chromium).
- docs: `apps/cdk-docs/content/components/stepper.md`, examples `apps/cdk-docs/examples/stepper-{basic,linear,vertical,list}`.

## Rules / invariants
- `semantics` read once: `tabs` (default; horizontal tablist / vertical buttons + regions = Material) or `list` (`ol` / `li`, `aria-current="step"`, native `<button>` headers; `isReadOnly` → plain `div`s).
- Inactive panels `hidden` + `inert`; `data-position` (`previous` / `current` / `next`, RTL-aware) for user transitions.
- No `aria-posinset` / `aria-setsize` (set size unknown while the server renders the first steps).
- Resumable: nothing runs at load; root `preload="visible"` (handlers + their bindings fetched when visible). Callbacks / `stepControl` accessors = inline arrows or local functions in `.tsx`.

## Deviations (vs Angular CDK)
- Components instead of directives; `StepControl` = `{ valid, invalid?, pending?, reset? }` (booleans or accessors) instead of `AbstractControl`; `completed` / `hasError` / `editable` accessors are read live and not cleared by `reset()` (pass a Signal to make them resettable).
- `semantics="list"` + `isReadOnly`: Rivet additions. No animations (style `data-position`), no Material intl / icon overrides.

## Gotchas
- `isLast` is exact only once every step registered (client); server markup of the first steps sees a partial list.
- Server: deep parts read the stepper through `StepContext.stepper` (a nested `useContext(StepperContext)` resolved `null` on the server in the ui wrapper).
- Linear headers become navigable only after the previous step was interacted (Angular semantics), not merely when its control turns valid.

## See also
- [../CLAUDE.md](../CLAUDE.md), `docs/guides/resumability.md`, `libs/ui/src/components/stepper/`.

- ID-RESUME (2026-10-27): Generated step-header / panel IDREF roots use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.
