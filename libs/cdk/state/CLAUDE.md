# @rivetjs/cdk/state
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Serializable state factories, one per widget (React Stately ports): plain signals + JSON, methods as free functions taking the state.

## Entry points
No bare `@rivetjs/cdk/state`; pattern `./state/*` -> `state/<file>.ts`. Main exports per file:
- `calendar` - `createCalendarState`, `createRangeCalendarState` (`isDisabled` / `isReadOnly` / `isInvalid` may be accessors: `state.disabled` / `readOnly` / `invalid`, read `isCalendarDisabled` / `isCalendarReadOnly`; live props), `focusNextDay`/`Row`/`Page`/`Section`…, `selectDate`, `setValue`, `focusedDate`, `visibleRange`, `calendarValue`, `getWeeksInMonth`, `isCellDisabled`/`Unavailable`…
- `grid` - RS useGridState: `createGridState`, `gridState` view, `gridFocusKey`, `resetGridFocusedKey`; `table` - RS useTableState: `createTableState`, `tableState` view, `sortTable`, `toggleTableKey`, `setTableKeyboardNavigationDisabled`, `tableCollection`, `filteredTableState`; `table-column-resize` - RS useTableColumnResizeState: `createTableColumnResizeState`, `startColumnResize`, `endColumnResize`, `tableColumnResizeState` view
- `checkbox-group` - `createCheckboxGroupState` (`isDisabled` / `isReadOnly` / `isRequired` may be accessors: `state.disabled` / `readOnly` / `requiredNow`, live props P5), `isCheckboxGroupDisabled`, `isCheckboxGroupReadOnly`, `isCheckboxGroupRequired`, `isRequiredNow`, `isSelected`, `setValue`, `addValue`, `removeValue`, `toggleValue`, `setInvalid`, `isGroupInvalid`; optional mutable `data` (RA checkboxGroupData: name, form, slot ids, validationBehavior) written by `checkboxGroupProps`
- `autocomplete` - `createAutocompleteState`, `autocompleteInputValue`, `setAutocompleteInputValue`, `setFocusedNodeId`
- `combobox` - `createComboBoxState`, `createComboBoxCore` + `comboBoxSelectionState` (resumable split), `comboInputText` (input text; runs the update loop when a live controlled accessor changed: resumed in-place re-sync), `isComboReadOnly` (live `isReadOnly`: `core.readOnly`), `comboCollection`, `comboDisplayedCollection`, `comboSelectedItems`, `comboValue`, `setComboInputValue`, `setComboValue`, `openCombo`, `toggleCombo`, `closeCombo`, `commitCombo`, `revertCombo`, `comboSelectionChange`, `comboUpdate`
- `date-field` - `createDateFieldState`, `createPickerFieldState` (owner `isDisabled` / `isReadOnly` / `isRequired` may be accessors: `owner.disabled` / `readOnly` / `required`, read `ownerDisabled` / `ownerReadOnly` / `ownerRequired`; live props; pickers too), `segments`, `increment`/`decrement`(+`Page`/`ToMax`/`ToMin`), `setSegment`, `clearSegment`, `fieldValue`, `IncompleteDate`…
- `date-picker` - `createDatePickerState`, `createDateRangePickerState`, `setDateValue`, `setTimeValue`, `setDateRange`, `setOpen`, `commitOnClose`, `formatValue`…
- `date-intl` - `dateValidationMessages` (generated, used by `date-field.ts`; its `getLocale` validates `navigator.language` with `Intl.getCanonicalLocales`, no formatter data load — `../i18n/CLAUDE.md`)
- `disclosure` - `createDisclosureState`, `toggleDisclosure`, `createDisclosureGroupState` (`isDisabled` / `allowsMultipleExpanded` may be accessors: `liveDisabled`, read `isGroupDisabled`), `allowsMultiple`, `isGroupDisabled`, `toggleKey`, `isKeyExpanded`, `registerDisclosure` / `unregisterDisclosure`, `openAll` / `closeAll` (Angular accordion extras)
- `form-validation` - `createFormValidationState`, `realtimeValidation`, `displayValidation`, `updateValidation`, `commitValidation`, `resetValidation`, `clearServerErrors`
- `list` - `createListState`, `createSingleSelectListState`, `getItemId`, `itemSelected`/`Disabled`/`TabIndex`/`Focused`, `collectionTabIndex`, `listBoxLinkBehavior`, re-exports `isSection`, `textOf`, `flatItems`
- `menu` - `createMenuTriggerState`, `openMenu` / `closeMenu`, `createSubmenuTriggerState`, `openSubmenu` / `closeSubmenu` / `closeAllSubmenus`, `createMenuState` (context `virtual?` → `state.virtual`, virtualized menus), `registerMenuItem` / `registerMenuSection` / `registerSubmenu`, `submenuId`, `selectionOf`
- `overlays` - `createOverlayTriggerState`, `setOpen`, `openOverlay`, `closeOverlay`, `toggleOverlay`, `setPoint`
- `radio-group` - `createRadioGroupState` (`isDisabled` / `isReadOnly` / `isRequired` may be accessors: `state.disabled` / `state.readOnly` / `state.required`, live props P5), `isRadioGroupDisabled`, `isRadioGroupReadOnly`, `isRadioGroupRequired`, `setSelectedValue`, `setLastFocusedValue`, `isRadioInvalid`, `radioTabIndex`
- `search-field` - `createSearchFieldState`, `searchFieldValue`, `setSearchFieldValue`
- `select` - `createSelectState` (`items` optional), `selectValue`, `selectedKeys`, `selectedKey`, `selectedItems`, `selectedItemsOf(entries, keys)`, `setSelectValue`, `selectCollection`, `openSelect`, `toggleSelect`, `canOpen`, `isSelectDisabled` (`isDisabled` may be an accessor: `state.disabled`, live props P5; internal: the public `isDisabled` type stays boolean)
- `selection` - re-exports `../selection/state.ts` + `../selection/manager.ts` + collection types
- `tabs` - `createTabListState` (`selectedKey` Signal two-way / plain controlled / accessor = live controlled, kept as is and never written; `isDisabled` may be an accessor: `state.disabled`, read `isTabsDisabled(state)`; `orientation` / `keyboardActivation` / `disabledKeys` may be accessors: creation values + `state.live`, read `tabsOrientation` / `tabsKeyboardActivation` / `tabsDisabledKeys`; live props P5; `tabs: () => TabKey[]` for the default selection), `findDefaultSelectedKey`, `selectTab`, `setTabFocusedKey`, `effectiveFocusedKey`, `tabsSelectionState`, `isTabsDisabled`
- `toast` - `ToastQueue` (`name`, wake event), `createToastState`, `createToastQueueState`, `Timer`, `TOAST_QUEUE_EVENT`
- `toggle` - `createToggleState` (`isSelected` plain = controlled, Signal = two-way, accessor = controlled accessor via `controllable`; `isDisabled` may be an accessor, kept as `state.isDisabled`); `isReadOnly` may be an accessor (live props P5), kept as `state.isReadOnly`; check with `isToggleReadOnly(state)`, `selected()`, `setSelected`, `toggle`, `isToggleSelected`
- `toggle-group` - `createToggleGroupState(props, live?: ToggleGroupLive)`, `isGroupDisabled`, `isEmptySelectionDisallowed` (live `isDisabled` / `disallowEmptySelection` via the component's `live` getter object; `state.isDisabled` / `state.disallowEmptySelection` = values at creation; `selectionMode` read once), `toggleKey`, `setSelected`, `setSelectedKeys`, `selectedKeysOf`, `isKeySelected` (`selectedKeys` plain = controlled, Signal = two-way; only the selection signal is region state)
- `tooltip` - `createTooltipTriggerState` (`delay` / `closeDelay` may be accessors: creation values + `state.live`, read at event time by `tooltipDelay` / `tooltipCloseDelay`), `tooltipDelay`, `tooltipCloseDelay`, `openTooltip`, `closeTooltip`, `disposeTooltip`, `TOOLTIP_DELAY`, `TOOLTIP_COOLDOWN`

## Layout
- consumers: `calendar` -> calendar/, range-calendar/; `checkbox-group`, `toggle` -> checkbox/, switch/, toggle-button/; `combobox` -> combobox/; `autocomplete` -> autocomplete/; `search-field` -> search-field/; `date-field`, `date-picker` -> date-field/, date-picker/; `form-validation` -> form/, label/, button/, checkbox/, switch/, radio-group/, text-field/, date-*/, select/; `list` -> listbox/, select/, menu/, combobox/ (types); `menu` -> menu/; `disclosure` -> disclosure/, accordion/; `overlays` -> overlay/, popover/, dialog/, modal/, tooltip/, menu/, select/; `radio-group` -> radio-group/; `select` -> select/; `tabs` -> tabs/; `toggle-group` -> toggle-button-group/, toggle-button/; `tooltip` -> tooltip/; `toast` -> toast/
- no consumer in libs: `selection` (entry point only)
- tests: `tests-components/calendar-state.test.ts`, `calendar-keyboard.test.ts`, `calendar-parts.test.ts` (calendar); `tests-components/date-picker-state.test.ts` (date-field, date-picker, form-validation); `tests/overlay.test.ts`, `tests/modal.test.ts` (overlays); `tests/tooltip.test.ts` (tooltip); `tests-components/tabs-state.test.ts` (tabs); `tests/toggle-group-state.test.ts` (toggle-group); `tests/toast-state.test.ts` (toast; port of useToastState.test.js + Rivet wake / Timer cases); `tests/checkbox-group-state.test.ts` (checkbox-group; RS useCheckboxGroupState.test.tsx); `tests-components/select.test.ts` + route `tests-components/app/src/routes/select.tsx` (`createSelectState`); others only through component tests
- `tests/combobox-state.test.ts` (useComboBoxState port), `tests/search-field-state.test.ts` (useSearchFieldState port)
- `tests/disclosure-state.test.ts` (RS useDisclosureState / useDisclosureGroupState), `tests/accordion.test.ts` (Angular accordion.spec on the group state)
- no direct tests: `checkbox-group`, `radio-group`, `toggle`, `menu`, `list`, `autocomplete`

## Upstream
- `calendar.ts` `@react-stately/calendar` useCalendarState, useRangeCalendarState, utils. Rivet: dates as strings in signals (`@rivetjs/cdk/date` `stringifyDateValue`), read back via accessors (`focusedDate(state)`); render-time corrections (focus outside visible range / outside [min, max]) run after every write and on read
- `date-field.ts` `@react-stately/datepicker` useDateFieldState, IncompleteDate, placeholders, utils, types; temp `IncompleteDate` kept as plain fields beside the value string; picker fields share the picker's value; `ownerFormat` carries a standalone field's `maxGranularity` (RS formatOpts: TimeField messages show the time only)
- `date-picker.ts` useDatePickerState, useDateRangePickerState; shared `setOpen`/`isInvalid`/`formatValue` dispatch on `kind`; overlay = `createOverlayTriggerState`; region state; `setDateValue` / `setDateRange(state, value, beforeCommit?)`: `beforeCommit` runs right before `commitValidation` (the picker syncs its hidden inputs there: RS reads native validity after the update)
- `date-intl.ts` react-stately `intl/datepicker/*.json` - generated, do not edit
- `toggle-group.ts` useToggleGroupState: methods → free functions; read the selection with `selectedKeysOf` (tracks the two-way source when given); region state; Rivet extension `selectedKey` / `defaultSelectedKey` (single selection: plain key / `null` controlled, `Signal<Key | null>` two-way via `state.keySource`; `selectedKeys` wins; used by `@rivetjs/ui/segment`)
- `checkbox-group.ts` useCheckboxGroupState (invalid map = signal of a record); `radio-group.ts` useRadioGroupState; `toggle.ts` useToggleState
- `form-validation.ts` useFormValidationState; realtime / display validation are read functions, not per-render values
- `disclosure.ts` `@react-stately/disclosure`: two-way `isExpanded` / `expandedKeys`; single-expansion clamp on create + every write; Angular extras: `allowsMultipleExpanded` Signal, disabled members kept by `openAll` / `closeAll`
- `overlays.ts` useOverlayTriggerState: `isOpen` plain / two-way Signal / read-only accessor (`controllable`), or `defaultOpen`; region state
- `tooltip.ts` useTooltipTriggerState: region state; per-instance timers in a browser WeakMap keyed by the state; global warmup / cooldown = one mutable module object (resume-extracted symbols import module bindings read-only)
- `toast.ts` useToastState / ToastQueue: `ToastQueue` used directly (browser module singleton); queue carries a `name` so a server-rendered `<ToastRegion queue>` finds it: while unsubscribed with visible toasts it dispatches `rv-toast-queue` on `document` once per update (no timed retries: the resume runtime attaches document `clientEvent` listeners before resumed handlers run); Deviation: `Timer.reset` / `resume` never double-start
- `select.ts` `@react-stately/select` useSelectState; region state; collection = data `items`
- `list.ts` `@react-stately/list` useListState, useSingleSelectListState over `../_adapters/collections.ts` + `_adapters/selection.ts`; items not stored (browser handlers read the DOM); `itemTabIndex` / `itemFocused` read focus keyed (`../selection/keyed.ts` `isFocusedKey`, key before `isFocused`)
- `menu.ts` useMenuTriggerState, useSubmenuTriggerState, useTreeState for menus + RAC MenuSection selection; region state
- `tabs.ts` useTabListState + useSingleSelectListState; `selectedKey` source of truth (plain value = read-only cell, `controlled`: `selectTab` only fires `onSelectionChange`); "always a tab selected" at creation over `options.tabs` (no `onSelectionChange`; skipped for a plain controlled key); focus-follows-selection via `effectiveFocusedKey` + `focusedSelection`
- `combobox.ts` `@react-stately/combobox` useComboBoxState: core (signals + JSON, region state) + selection view built in `.tsx`; module caches keyed by `core.isOpen` (shared by core and views); own controlled logic (value / inputValue plain = controlled, Signal = two-way)
- `autocomplete.ts` useAutocompleteState (`controllable` input value); `search-field.ts` useSearchFieldState (plain / Signal / accessor value)

## Rules / invariants
- State = signals + JSON + free functions; no class instances, no closures over DOM; `SelectionManager` / collections derived per event
- Controlled values are two-way signals (most files: `controllable(signal, default)` from `@rivetjs/cdk/interactions`)
- Region state (`_regionState`): `overlays`, `tooltip`, `select`, `combobox`, `menu`, `date-picker`, `toggle-group` - a resumed page re-creating the widget's region keeps the state
- Callback props stored on state (`onChange`, `onSelectionChange`, `onAction`) must be inline arrows / local functions to resume
- Generated file `date-intl.ts`: regenerate, never hand-edit

## Commands
- `npx vitest run --project cdk libs/cdk/tests/overlay.test.ts libs/cdk/tests/modal.test.ts libs/cdk/tests/tooltip.test.ts`
- `npx vitest run --project cdk-components libs/cdk/tests-components/calendar-state.test.ts libs/cdk/tests-components/calendar-keyboard.test.ts libs/cdk/tests-components/calendar-parts.test.ts libs/cdk/tests-components/date-picker-state.test.ts libs/cdk/tests-components/tabs-state.test.ts`

## Gotchas
- Two list states: `list.ts` (adapter-based, used by components) vs `../collections/list-state.ts` (faithful port, unused by components)
- `list.ts`, `select.ts`, `menu.ts`, `tabs.ts` import `../_adapters/*` (see `../_adapters/CLAUDE.md`)
- `calendar.ts` / `date-field.ts` / `time-field.ts` / `date-picker.ts`: `state.aria` hookData is plain data only (a closure over the state = self-cycle, resume rejects); exception: a picker field's `extraDescribedBy` = the picker's `describedBy` accessor (closes over the picker state, not the field: no cycle) with `presentation: true`; TimeField state keeps the calendar identifier only (no `createCalendar` fn)
- Module-level / imported functions as props are not serializable (`isDateUnavailable`, `createCalendar`) - wrap in a local const
- `date-field.ts`: `resolvedOptionsOf(formatter)` = one shared read-only `resolvedOptions()` per cached `DateFormatter` (WeakMap; never mutate it); `resolveCalendar` memoised per `locale|hourCycle` with the default calendar factory (was a new `Intl.DateTimeFormat` per field state) (HOTPATH 2026-10-09)

## See also
- [../CLAUDE.md](../CLAUDE.md), [../selection/CLAUDE.md](../selection/CLAUDE.md), [../collections/CLAUDE.md](../collections/CLAUDE.md), [../_adapters/CLAUDE.md](../_adapters/CLAUDE.md)
- component folders' `CLAUDE.md` (listbox, select, combobox, tabs, menu, calendar, date-field, date-picker, tooltip, …)
- `docs/guides/resumability.md`, `docs/guides/aria.md`
