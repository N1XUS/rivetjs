# @rivetjs/cdk/combobox
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC ComboBox port: text input + filtered ListBox in a non-modal Popover, composed from RAC parts.

## Entry points
- `@rivetjs/cdk/combobox` -> `index.tsx`: `ComboBox`, `ComboBoxValue`, `ComboBoxContext` (rv-combobox), `ComboBoxStateContext` (rv-combobox-state), `ComboBoxValueContext` (rv-combobox-value), types `ComboBoxProps`, `ComboBoxRenderProps`, `ComboBoxValueProps`, `ComboBoxValueRenderProps`, `ComboBoxState`, `MenuTriggerAction`, `SelectionMode`, `ValueType`, `ChangeValueType`, `ComboBoxValidationValue`, `Key`
- `@rivetjs/cdk/combobox/behaviour` -> `behaviour.tsx` (explicit export): `comboBoxProps(props, state)` (RA useComboBox) -> `{labelProps, inputProps, buttonProps, listBoxProps, valueProps, descriptionProps, errorMessageProps, ids, listBoxId, isInvalid(), validationErrors(), validationDetails()}`; handlers `comboBoxInputKeyDown`, `comboBoxInputBlur`, `comboBoxInputFocus`, `comboBoxInputTouchEnd`, `comboBoxLabelClick`, `comboBoxButtonPress`, `comboBoxButtonPressStart`, `comboBoxButtonKeyDown`; `comboBoxEffects` / `comboBoxDisposeEffects` (announcements, ariaHideOutside, item-action close; the component's unmount dispose effect is `when: "interaction"`: the effects only exist after one, so a resumed ComboBox records no idle `fx`)
- state: `@rivetjs/cdk/state/combobox` (react-stately useComboBoxState): `createComboBoxState`, `createComboBoxCore` + `comboBoxSelectionState` (resumable split), `comboCollection`, `comboDisplayedCollection`, `comboSelectedItems`, `comboValue`, `setComboInputValue`, `openCombo`, `toggleCombo`, `closeCombo`, `commitCombo`, `revertCombo`, `comboSelectionChange`, `comboUpdate`, …
- `intl.ts`: generated react-aria `intl/combobox` strings

## Parts / contexts provided by ComboBox
LabelContext, ButtonContext (+ `isPressed` while open), InputContext, FieldInputContext, OverlayTriggerStateContext (`open.onChange(false)` = `closeCombo`), PopoverContext (`trigger: "ComboBox"`, `placement: "bottom start"`, `isNonModal`, triggerRef = Group else Input, `clearContexts`), ListBoxContext (listBoxProps), ListStateContext (displayed collection + combobox selection), TextContext (description / errorMessage slots), GroupContext, FieldErrorContext, ComboBoxValueContext, ComboBoxStateContext.

## Layout
- `index.tsx` - ComboBox (builds the collection from children via `collectionOf`, `items ?? defaultItems` reach the ListBox through ListBoxContext), ComboBoxInner (state, providers, root `rv-ComboBox` with `data-focused/open/disabled/readonly/invalid/required`, hidden inputs for `formValue="key"`), ComboBoxValue (`listFormatter` of selected textValues)
- `behaviour.tsx` - useComboBox port; transient per-instance data in a WeakMap keyed by `state.isOpen`
- tests: `tests/combobox-state.test.ts` (useComboBoxState port + core/view identity), `tests/combobox.browser.test.tsx` (RAC ComboBox.test.js port), `tests-components/combobox.test.ts` (story `/combobox`, resumed), `tests-components/dom-events-overlays.test.ts`, `tests-components/axe.test.ts`

## Rules / invariants
- `selectedKey` / `value` / `inputValue`: plain = controlled, Signal = two-way; `items` may be an accessor (external changes re-run `comboUpdate` from an effect); `isInvalid` may be an accessor
- Render props are accessors; `class` = RAC `className`
- Resumable closures: object-literal arrows (`build.content`, `openIO`, `io`, `fieldError.validation` = the FieldErrorContext value) not call-argument / array-element arrows (an arrow as a `values` array element is not resumable: the FieldError of a resumed ComboBox never rendered); no props reads inside bags (destructure first)
- multiple: hidden inputs per key = `hiddenKeys(core).map(...)` in the root's expression child (a resumed function child returning a JSX array never re-rendered: runtime bug, scratchpad runtime-bugs.md; an expression at a component's fragment root is not reactive on the client)
- RS validation: blur commits only when the input / selection changed (focus + Tab shows nothing); aria mode has no required error (only `validate` / `isInvalid` / server errors); `tests-components/combobox.test.ts` "validation (native)" commits through a blocked submit
- Effects returning cleanups use `onCleanup` (`effect` ignores return values)
- Live props (P5): ComboBox / ComboBoxValue `class` / `style` / `children` render props read live (`renderProps(…, props)`); ComboBox + ComboBoxInner bodies untracked; `liveOptions(props, [isDisabled, isReadOnly, isRequired, isInvalid, items], [value, selectedKey, inputValue])` once in `comboBox` (accessors reach the state, `textFieldProps` input bag — `disabled` / `readOnly` / `required` —, button `isDisabled` (`eitherFlag`), `GroupContext`, render-prop values; handlers `read()` at event time; core `readOnly` → `isComboReadOnly`); root `data-disabled` / `data-readonly` / `data-required` set on the `dom` bag (`dataFlag`), not as JSX attributes. Controlled `value` / `selectedKey` / `inputValue` accessors: the input's value binding calls `comboInputText(core)` (runs `comboUpdate` when the accessor changed since the last update) — the input text follows in place on a resumed page too (the client `effect` still runs the loop for item / Signal changes). Tests: `tests/live-controlled.browser.test.tsx`, `tests/live-flags-ssr.test.ts`, story `/live-props` `#lc-combo` (input node kept) / `#lf-combo*`

## Gotchas
- Dynamic `{() => …}` children inside `<ListBox>` are tracked by the build pass (rebuild on change); they register after their eager JSX siblings, so put a leading conditional item ("Create …") and the items after it in one `{() => [cond() ? <ListBoxItem id="create" …/> : null, <ListBoxItem>…</ListBoxItem>, …]}`; give `textValue` for non-string children and an explicit `id` to the conditional item (keeps the generated `$.n` ids of the others stable)
- Resumed story pages: first-interaction keystrokes lost (runtime: resumed spread re-applies `value` from server state) — `tests-components/combobox.test.ts` typing / custom / multiple / validation cases fail until fixed
- SSR `aria-describedby` names only rendered parts (COMBOBOX-DEV 2026-10-08): the input renders before Description / FieldError / ComboBoxValue, so the server runs `probeSlots(values, children)` first (Text / ComboBoxValue `probeSlot` in the probe; `probeSlots` / `slotProbing` from `#server`) and the input reads `slotIdRef(id, false)`; inside another field's probe the ComboBox returns `null`; was: absent parts' ids kept, never dropped on a resumed page (dev `aria-idref` warning)
- InputGroup (cdk Group) renders real DOM in the collection build pass (a `computed`): its `[Input, Trigger]` array becomes runtime `cells`, which seed their signals (runtime `dom-v2.ts`) — was "Signal writes are not allowed during computed evaluation" on the first interaction of a resumed page
- Popover ignores `clearContexts` (C1b); popover width = Popover's `--trigger-width` (RAC menuWidth fallback without a Group not ported)
- Input `textFieldProps` gets the user `onFocusChange` (RA passes `...props`); onFocus / onBlur: native on the input (combobox handler first, then the text-field bag's `onFocusIn` (validity) and its `onFocus` / `onBlur` user callbacks when present; the bag's `onFocusIn` is cleared so it does not run twice)
- `<ListBox id>` wins over the generated list id (RAC mergeIds): `listBoxProps.id` is a `MergedId` (`slots`); ListBox writes its own id into `menuId.current`, input/button `aria-controls` + `aria-activedescendant` read it. Server: ListBox renders after the input, so SSR markup keeps the generated id until resume (client re-points)
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on ComboBox / ComboBoxValue (`div`)
- `menuTrigger="focus"` + button press on an unfocused input: the input focus opens the menu inside the press; React batches it with the press `toggle` (which reads the pre-focus closed state and opens), a signal toggle would close it again → `keptOpenByFocus` in `behaviour.tsx` keeps it open (trigger "manual"); `tests/combobox.browser.test.tsx` Rivet case
- Not ported: useAsyncList cases

## See also
- [../CLAUDE.md](../CLAUDE.md), [../listbox/CLAUDE.md](../listbox/CLAUDE.md), [../autocomplete/CLAUDE.md](../autocomplete/CLAUDE.md), [../state/CLAUDE.md](../state/CLAUDE.md)
- `apps/cdk-docs/content/components/combobox.md`

- ID-RESUME (2026-10-27): Generated listbox and menu-trigger roots (state/combobox.ts and behaviour.tsx) use the shared `resumedId()` keyed-signal helper. The resume record retains the server id when parts adopt independently. Existing explicit-id fallback and ARIA behaviour are unchanged.

- CX-VPICK: input keyboard focus synchronization retains `isVirtualized: true` from the collection options. Like RA useOption's post-render focus effect, `syncFocus` waits for an offscreen persisted option to render before moving virtual focus and scrolling it into view. UI integration tests cover End / Home and filtered selection over 10,000 items.
