---
title: Autocomplete
description: Autocomplete from @rivetjs/cdk wraps a SearchField and a Menu or ListBox; typing filters the collection, arrow keys move virtual focus in it.
template: guide
status: experimental
related: [components/search-field, components/combobox, components/listbox, components/menu, components/select, foundations/collections]
---

`Autocomplete` is a port of React Aria Components `Autocomplete` (with react-aria `useAutocomplete` and react-stately `useAutocompleteState`). It renders no element: it connects an input field (`SearchField` or `TextField`) to a collection (`ListBox`, `Menu`, `GridList`, `TagGroup`, `Table`) placed inside it. Typing in the field filters the collection with `filter`; the arrow keys move a virtual focus through the collection (`aria-activedescendant`) while DOM focus stays in the input, and :kbd[Enter] selects or runs the focused item. Use it for command palettes, searchable menus and filterable lists; for a field with a popup listbox, use [ComboBox](combobox.md).

::example{id=autocomplete-menu}

## Anatomy

```tsx
<Autocomplete>
  <SearchField /> {/* or <TextField /> */}
  <ListBox /> {/* or <Menu />, <GridList />, <TagGroup />, <Table /> */}
</Autocomplete>
```

`Autocomplete` adds no markup. It gives the input (through `FieldInputContext`) `aria-controls` (the collection id), `aria-autocomplete="list"`, `aria-activedescendant` (the virtually focused item), `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, `enterkeyhint="go"`, and its key / focus / input handlers. It gives the collection (through `SelectableCollectionContext`) a generated id, the label "Suggestions" (localized), `shouldUseVirtualFocus`, `disallowTypeAhead` and the `filter`. The collection keeps its own markup and classes ([ListBox](listbox.md#anatomy), [Menu](menu.md#anatomy)); the virtually focused item has `data-focused` / `data-focus-visible`.

## Import

```ts
import { Autocomplete } from "@rivetjs/cdk/autocomplete";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
// Contexts alone (for a custom field or collection):
import { FieldInputContext, SelectableCollectionContext, AutocompleteStateContext } from "@rivetjs/cdk/autocomplete-contexts";
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | content | none | The input field and the collection to filter. |
| `filter` | `(textValue: string, inputValue: string, node: Node<T>) => boolean` | none | Keeps the items it returns true for. Without it the collection is not filtered (filter `items` yourself from `inputValue`). |
| `inputValue` | `string \| Signal<string>` | none | Controlled text; a Signal is written two-way. |
| `defaultInputValue` | `string` | `""` | Initial text (uncontrolled). |
| `onInputChange` | `(value: string) => void` | none | |
| `disableAutoFocusFirst` | `boolean` | `false` | Do not focus the first item after typing narrows the collection. |
| `disableVirtualFocus` | `boolean` | `false` | The collection gets real focus (it is tabbable) instead of virtual focus from the input. |
| `slot` | `string \| null` | none | `AutocompleteContext` slot. |

::api{symbol="@rivetjs/cdk/autocomplete#AutocompleteProps"}

## Filtering

`createFilter(options?, locale?)` (react-aria `useFilter`) returns `{ startsWith, endsWith, contains }` over an `Intl.Collator` with `usage: "search"`; `{ sensitivity: "base" }` ignores case and accents. Create it at module level or inside a handler (the functions are plain closures and do not serialize), and pass `filter` as an inline arrow. `getCollator(locale, options)` returns the cached collator.

| Export | What it does |
| --- | --- |
| `createFilter(options?: Intl.CollatorOptions, locale?: string): Filter` | Localized `startsWith(string, substring)`, `endsWith`, `contains`. `locale` defaults to the current locale (render time). |
| `getCollator(locale, options?)` | Cached `Intl.Collator` (react-aria `useCollator`). |

::api{symbol="@rivetjs/cdk/i18n/filter#createFilter"}

For a controlled filter (server results, custom ranking), omit `filter`, own the text with `inputValue` / `onInputChange`, and pass the matching `items` to the collection.

`inputValue` takes a Signal to own the text (two-way): here a prefix filter, and a button that sets the query.

::example{id=autocomplete-filter}

## Collections

The collection merges `SelectableCollectionContext`: `ListBox`, `Menu`, `GridList`, `TagGroup` and `Table` support it. With a `Menu`, :kbd[Enter] runs the focused item's action (a command palette); with a `ListBox`, it selects. A `ListBox` without children renders its `items`.

:::warning
A `ListBox` inside an `Autocomplete` does not pick up the autocomplete's collection props yet: it keeps its own id (the input's `aria-controls` points elsewhere), is not filtered and gets no virtual focus. Use a `Menu` until this is fixed.
:::

## DOM events and attributes

`Autocomplete` renders no element and takes no DOM props. The field's and the collection's own DOM props apply as on their pages. The autocomplete owns the input's `onKeyDown`, `onFocus`, `onBlur`, `onPointerDown`, `onBeforeInput` and change handling (its behaviour runs first, then the field's), and puts a `focusin` handler on the collection root (`onFocusIn`).

## Accessibility

- The input controls the collection (`aria-controls`) with `aria-autocomplete="list"`; `aria-activedescendant` points at the virtually focused item, so screen readers announce it while the caret stays in the input.
- The collection is labelled "Suggestions" (localized from the locale) unless it has its own label.
- With `disableVirtualFocus`, the input and the collection are separate tab stops.

### Keyboard

| Key | Action |
| --- | --- |
| Typing | Filters; the first item is focused (unless `disableAutoFocusFirst`). |
| :kbd[ArrowDown], :kbd[ArrowUp], :kbd[Home], :kbd[End], :kbd[PageDown], :kbd[PageUp] | Move the virtual focus in the collection (the caret does not move). |
| :kbd[ArrowLeft], :kbd[ArrowRight] | Move the caret when no item is focused; else go to the collection (grids, submenus). |
| :kbd[Enter] | Select / run the focused item. |
| :kbd[Escape] | Handled by the field first (a SearchField clears its text), then the collection. |
| :kbd[Space] | Types a space (never runs an item). |
| :kbd[Tab] | Leaves the field (not sent to the collection). |

## Resumability

- `Autocomplete` renders only providers; the field and the collection render on the server as usual.
- The state (`createAutocompleteState`: the text, the focused node id) serializes. Callbacks (`filter`, `onInputChange`) must be inline arrows or local consts.
- RA's `focusin` / `beforeinput` listeners are context props (`onFocusIn`, `onBeforeInput`), so they resume as delegated handlers.

## Custom markup

`@rivetjs/cdk/autocomplete/behaviour` is the layer `Autocomplete` is built on (react-aria `useAutocomplete`): `autocompleteProps(props, state)` returns `{ inputProps, collectionProps, collectionRef, inputRef, filter, aria }`; the handlers (`autocompleteKeyDown`, `autocompleteKeyUpCapture`, `autocompleteFocusIn`, `autocompleteFocusFirstItem`, `autocompleteClearVirtualFocus`, `autocompleteBeforeInput`, `autocompleteChange`, `autocompleteBlur`, `autocompleteFocus`, `autocompletePointerDown`) and `autocompleteHasCollection`, `autocompleteShouldUseVirtualFocus` are exported. The state is `@rivetjs/cdk/state/autocomplete` (`createAutocompleteState`, `autocompleteInputValue`, `setAutocompleteInputValue`, `setFocusedNodeId`). A custom field merges `FieldInputContext`; a custom collection merges `SelectableCollectionContext` (`@rivetjs/cdk/autocomplete-contexts`).

::api{symbol="@rivetjs/cdk/autocomplete/behaviour#autocompleteProps"}

::api{symbol="@rivetjs/cdk/autocomplete-contexts#SelectableCollectionContextValue"}

## Upstream

| Rivet | Upstream |
| --- | --- |
| `Autocomplete`, `AutocompleteContext`, `AutocompleteStateContext`, `SelectableCollectionContext`, `FieldInputContext` | RAC `Autocomplete.tsx` |
| `@rivetjs/cdk/autocomplete/behaviour` | react-aria `useAutocomplete` |
| `@rivetjs/cdk/state/autocomplete` | react-stately `useAutocompleteState` |
| `@rivetjs/cdk/i18n/filter` | react-aria `useFilter`, `useCollator` |

Deviations: `inputValue` takes a Signal (two-way); the contexts live in their own module (`@rivetjs/cdk/autocomplete-contexts`) so collections import them without the component; `focusin` / `beforeinput` listeners are context props.

## Not yet supported

- `ListBox` as the wrapped collection (see [Collections](#collections)).
- The upstream `Autocomplete` test suite and test utils are not ported yet.
