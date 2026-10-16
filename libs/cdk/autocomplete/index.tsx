// Ported from react-aria-components Autocomplete (packages/react-aria-components/src/Autocomplete.tsx),
// Apache-2.0, © Adobe.
// An autocomplete allows users to search or filter a list of suggestions: it wraps an input field
// (SearchField / TextField, via `FieldInputContext`) and a collection (ListBox / Menu / GridList /
// TagGroup / Table, via `SelectableCollectionContext`); typing filters the collection (`filter`) and
// arrow keys move virtual focus through it while DOM focus stays in the input.
// Rivet:
// - renders no element (like RAC): only providers around `children`.
// - contexts live in `./contexts.ts` (`@rivetjs/cdk/autocomplete-contexts`) so collections import them
//   without this component; re-exported here.
// - `inputValue` plain = controlled, Signal = two-way (`controllable`).
// - see `./behaviour.tsx` for the hook port and its deviations (focusin / beforeinput as context props).
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { provide } from "@rivetjs/reactivity";
import { probeCollection } from "../collections/components.tsx";
import { useLocale } from "../i18n/index.ts";
import { mergeProps } from "../interactions/merge-props.tsx";
import { Provider, removeDataAttributes, slottedContext, type SlotProps } from "../slots/index.tsx";
import { createAutocompleteState } from "../state/autocomplete.ts";
import { autocompleteProps, type AriaAutocompleteProps } from "./behaviour.tsx";
import { AutocompleteContext, AutocompleteStateContext, FieldInputContext, SelectableCollectionContext } from "./contexts.ts";
import { liveOptions } from "../utils/live.tsx";

export {
  AutocompleteContext,
  AutocompleteStateContext,
  FieldInputContext,
  SelectableCollectionContext,
  type FieldInputContextValue,
  type SelectableCollectionContextValue,
} from "./contexts.ts";
export type { AutocompleteState } from "../state/autocomplete.ts";
export type { AriaAutocompleteProps } from "./behaviour.tsx";

export interface AutocompleteProps<T = object> extends AriaAutocompleteProps<T>, SlotProps {
  /** The children wrapped by the autocomplete. Consists of at least an input element and a collection element to filter. */
  children?: Content;
}

/** An autocomplete allows users to search or filter a list of suggestions. */
export function Autocomplete<T>(props: AutocompleteProps<T>) {
  const ctx = slottedContext(AutocompleteContext, props.slot);
  props = mergeProps(ctx ?? {}, props) as AutocompleteProps<T>;
  // Live props: a controlled `inputValue={text()}` stays live (accessor; `controllable` reads it, never writes it).
  const state = createAutocompleteState(liveOptions(props, [], ["inputValue"]));
  const { inputProps, collectionProps, collectionRef, inputRef, filter } = autocompleteProps<T>(
    { ...removeDataAttributes(props), filter: props.filter, disableAutoFocusFirst: props.disableAutoFocusFirst, locale: useLocale().locale },
    state,
  );
  const children = props.children;
  const collection = { ...collectionProps, filter, ref: collectionRef };
  // Rivet (server): the collection's own id (RA mergeIds, applied after React's first render) is merged before the
  // input's `aria-controls` is written — the resumed page never re-renders (collections/ `probeCollection`).
  if (typeof document === "undefined") provide(SelectableCollectionContext, collection, () => probeCollection(children));
  return (
    <Provider
      values={[
        [AutocompleteStateContext, state],
        [FieldInputContext, { ...inputProps, ref: inputRef }],
        [SelectableCollectionContext, collection],
      ]}
    >
      {children}
    </Provider>
  );
}
