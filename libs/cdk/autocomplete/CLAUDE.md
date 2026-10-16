# @rivetjs/cdk/autocomplete
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Autocomplete port: wraps an input field (SearchField / TextField) and a collection (ListBox / Menu / GridList / …); typing filters the collection, arrow keys move virtual focus while DOM focus stays in the input. Renders no element. Building block for "searchable Select" (C2a).

## Entry points
- `@rivetjs/cdk/autocomplete` -> `index.tsx`: `Autocomplete`, `AutocompleteProps`; re-exports contexts
- `@rivetjs/cdk/autocomplete-contexts` -> `contexts.ts`: `AutocompleteContext` (rv-autocomplete), `AutocompleteStateContext` (rv-autocomplete-state), `SelectableCollectionContext` (rv-selectable-collection; consumed by ListBox), `FieldInputContext` (rv-field-input; consumed by SearchField, ComboBox provides it), `SelectableCollectionContextValue`, `FieldInputContextValue`
- `@rivetjs/cdk/autocomplete/behaviour` -> `behaviour.tsx` (explicit export): `autocompleteProps(props, state)` (RA useAutocomplete) -> `{inputProps, collectionProps, collectionRef, inputRef, filter, aria}`; handlers `autocompleteFocusIn`, `autocompleteFocusFirstItem`, `autocompleteClearVirtualFocus`, `autocompleteBeforeInput`, `autocompleteChange`, `autocompleteKeyDown`, `autocompleteKeyUpCapture`, `autocompleteBlur`, `autocompleteFocus`, `autocompletePointerDown`; `autocompleteHasCollection`, `autocompleteShouldUseVirtualFocus`
- state: `@rivetjs/cdk/state/autocomplete` (react-stately useAutocompleteState): `createAutocompleteState`, `autocompleteInputValue`, `setAutocompleteInputValue`, `setFocusedNodeId`
- `intl.ts`: generated react-aria `intl/autocomplete` strings

## Rules / invariants
- `inputValue`: plain = controlled, Signal = two-way (`controllable`)
- `filter(textValue, inputValue, node)`; `disableAutoFocusFirst`, `disableVirtualFocus`
- Transient (non-serializable) data in a WeakMap keyed by the state; document keyup capture listener added on keydown, removed on the matching keyup

## Deviations
- RA's `focusin` / `beforeinput` DOM listeners on the collection / input are context props (`onFocusIn`, `onBeforeInput`) so they resume
- `autocompleteHasCollection` is true on the server (`typeof document === "undefined"`) so SSR markup matches the client

## Gotchas
- Resumed pages: handler code reads the document via `getOwnerDocument(input / collection)`, never the bare `document` global (compiler RV2001); every closure that ends up in a context value is an object-literal arrow (`collectionFilter.filter`) — a bare ternary-branch arrow is not captured and 500s the SSR ("function is not serializable")
- Story `tests-components/app/src/routes/autocomplete.tsx` + `tests-components/autocomplete.test.ts`; open bug: resumed typing does not filter the ListBox (`test.fails`)
- A `ListBox` child does not pick up `SelectableCollectionContext` yet (own id, no filter / virtual focus; input `aria-controls` points at the context id); `Menu` works (docs examples `autocomplete-menu`, `autocomplete-filter`; `autocomplete-basic` ListBox steps skipped)
- Upstream Autocomplete.test.tsx + AriaAutocomplete.test-util not ported yet (need ListBox / Menu wiring of `SelectableCollectionContext` end to end)
- Collection id = `MergedId` (`collectionId`): a user `<ListBox id>` / `<Menu id>` wins (RAC mergeIds) and `aria-controls` follows it. Server renders the input before the collection, so `index.tsx` runs `probeCollection(children)` (build-mode pass, registers nothing; ListBox/Menu hidden path only calls `contextProps` then returns null) to learn the id before the input renders — `tests/listbox-ssr.test.ts`

## See also
- [../CLAUDE.md](../CLAUDE.md), [../search-field/CLAUDE.md](../search-field/CLAUDE.md), [../listbox/CLAUDE.md](../listbox/CLAUDE.md), [../combobox/CLAUDE.md](../combobox/CLAUDE.md)
