# libs/cdk/spinbutton
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RA `useSpinButton`: spinbutton aria attributes, keyboard shortcuts, press-and-hold spinning, value announcements.

## Entry points
- `behaviour.tsx` (`@rivetjs/cdk/spinbutton/behaviour`, explicit export): `spinButtonProps(props)` (aria-value* / disabled / readonly / required accessors), `createSpinButtonState()` (plain JSON: timer, isSpinning, isFocused, isUp, pressed flags), handlers `spinButtonKeyDown` / `KeyUp` / `Focus` / `Blur`, `spinButtonIncrement|DecrementPressStart|PressUp|PressEnd`, `spinButtonClearAsync`, `spinButtonDispose`, `spinButtonShortcuts`, `spinButtonTextValue`.
- `intl.ts`: generated ("Empty").

## Upstream
- react-aria `spinbutton/useSpinButton.ts`; test `tests/spinbutton.browser.test.tsx` (port of useSpinButton.test.js, all 14 cases).

## Rules / invariants
- Props accept accessors (`MaybeAccessor`); handlers are called from inline arrows (resumable).
- Announce effect created on focus, disposed on blur (browser-only WeakMap); text uses U+2212 minus.
- Spin delays: 400 ms mouse, 600 ms touch, then 60 ms steps, stopping at min / max.

## Gotchas
- Consumer: `../number-field/behaviour.tsx`.
- `SPIN_KEYS` / `spinKeysAttr(isDisabled, isReadOnly)`: the keys `spinButtonShortcuts` handle as a `data-rk` value (none while disabled / read-only; an accessor when a flag is live) — number-field / color-field inputs carry it, so the resume loader holds a cold spin key and replays it (SLIDER-KEY).
