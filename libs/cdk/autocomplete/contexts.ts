// Ported from react-aria-components Autocomplete (packages/react-aria-components/src/Autocomplete.tsx:
// `AutocompleteContext`, `AutocompleteStateContext`, `SelectableCollectionContext`, `FieldInputContext`),
// Apache-2.0, © Adobe.
// The contexts an `<Autocomplete>` (and ComboBox: FieldInputContext) provides: the wrapped input field
// (SearchField / TextField) merges `FieldInputContext`, the wrapped collection (ListBox / Menu / GridList /
// TagGroup / Table) merges `SelectableCollectionContext`.
// Rivet:
// - one tiny module (no component code): collections import it without pulling the Autocomplete in.
// - ACCESSOR RULE: state-dependent values are accessors read inside bindings / at event time:
//   FieldInputContext `value`, `aria-activedescendant`, `aria-controls`; SelectableCollectionContext
//   `shouldUseVirtualFocus`, `disallowTypeAhead`, `autoFocus`.
// - Deviation: RA `useAutocomplete` adds a `focusin` listener on the collection element and a
//   `beforeinput` listener on the input (`useEvent`); here they are props in the contexts —
//   `SelectableCollectionContext.onFocusIn` (the collection puts it on its root element) and
//   `FieldInputContext.onBeforeInput` (the field puts it on its `<input>`), so they resume as delegated
//   handlers without an effect.
import { createContext } from "@rivetjs/reactivity";
import type { ContextValue, MergedId, SlottedContextValue } from "../slots/index.tsx";
import type { Node } from "../collections/types.ts";
import type { MaybeAccessor } from "../interactions/utils.ts";
import type { AutocompleteState } from "../state/autocomplete.ts";
import type { AutocompleteProps } from "./behaviour.tsx";

/** RAC `SelectableCollectionContextValue`: what an Autocomplete passes to the collection it filters. */
export interface SelectableCollectionContextValue<T = unknown> {
  /** Rivet: a `MergedId` (RA `useId` the collection's own id merges into, `contextProps`); a plain id string also works. */
  id?: string | MergedId;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /** Hides the nodes it returns false for (build mode: `collection.filter`; live mode: each item). */
  filter?: (nodeTextValue: string, node: Node<T>) => boolean;
  /** Whether the collection items should use virtual focus instead of being focused directly. */
  shouldUseVirtualFocus?: MaybeAccessor<boolean | undefined>;
  /** Whether typeahead is disabled. */
  disallowTypeAhead?: MaybeAccessor<boolean | undefined>;
  /** RA `autoFocus` (`"first"` once the collection mounts after a forward-typing filter). */
  autoFocus?: MaybeAccessor<boolean | "first" | "last" | undefined>;
  /** Rivet: RA's `focusin` listener on the collection element — put it on the collection's root. */
  onFocusIn?: (event: FocusEvent) => void;
}

/** RAC `FieldInputContextValue`: what an Autocomplete / ComboBox passes to the input field it wraps. */
export interface FieldInputContextValue {
  id?: string;
  /** The controlled text (accessor). */
  value?: MaybeAccessor<string>;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onKeyUp?: (event: KeyboardEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onPointerDown?: (event: PointerEvent) => void;
  /** Rivet: RA's `beforeinput` listener on the input (`useEvent`) — put it on the `<input>`. */
  onBeforeInput?: (event: InputEvent) => void;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  "aria-controls"?: MaybeAccessor<string | undefined>;
  "aria-autocomplete"?: "none" | "inline" | "list" | "both";
  "aria-activedescendant"?: MaybeAccessor<string | undefined>;
  spellCheck?: boolean | "true" | "false";
  autoCorrect?: string;
  autoComplete?: string;
}

/** Props for the nearest `<Autocomplete>` (slotted). */
export const AutocompleteContext = createContext<SlottedContextValue<Partial<AutocompleteProps<any>>> | null>(null);

/** The state of the nearest `<Autocomplete>`. */
export const AutocompleteStateContext = createContext<AutocompleteState | null>(null);

/** Collection props from the nearest `<Autocomplete>` (ListBox, Menu, GridList, TagGroup, Table merge it with `contextProps`). */
export const SelectableCollectionContext = createContext<ContextValue<SelectableCollectionContextValue<any>, HTMLElement>>(null);

/** Input props from the nearest `<Autocomplete>` / `<ComboBox>` (SearchField, TextField merge it with `contextProps`). */
export const FieldInputContext = createContext<ContextValue<FieldInputContextValue, HTMLInputElement>>(null);
