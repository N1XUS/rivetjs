// Ported from react-stately useAutocompleteState (packages/react-stately/src/autocomplete/useAutocompleteState.ts),
// Apache-2.0, © Adobe.
// Rivet:
// - `inputValue` = `controllable` (plain value = controlled, Signal = two-way, else uncontrolled region
//   state); read with `autocompleteInputValue(state)`, write with `setAutocompleteInputValue`.
// - `focusedNodeId` = a signal (`setFocusedNodeId`).
// - state = signals + JSON + the caller's `onInputChange`: serializes on resumed pages.
import { signal, type Signal } from "@rivetjs/reactivity";
import { controllable, setControlledValue, type ControlledState } from "../interactions/controllable.ts";

export interface AutocompleteStateProps {
  /** The value of the autocomplete input (controlled: plain value; two-way: Signal). */
  inputValue?: string | Signal<string>;
  /** The default value of the autocomplete input (uncontrolled). */
  defaultInputValue?: string;
  /** Handler that is called when the autocomplete input value changes. */
  onInputChange?: (value: string) => void;
}

/** Emulate our other stately hooks which accept all "base" props even if not used. */
export type AutocompleteStateOptions = AutocompleteStateProps;

export interface AutocompleteState {
  /** The current value of the autocomplete input. */
  readonly inputValue: ControlledState<string>;
  /** The id of the current aria-activedescendant of the autocomplete input. */
  readonly focusedNodeId: Signal<string | null>;
}

/** Provides state management for an autocomplete component. */
export function createAutocompleteState(props: AutocompleteStateOptions): AutocompleteState {
  const propsOnInputChange = props.onInputChange;
  const onInputChange = propsOnInputChange
    ? (value: string) => {
        propsOnInputChange(value);
      }
    : undefined;
  return {
    inputValue: controllable<string>(props.inputValue, props.defaultInputValue ?? "", onInputChange),
    focusedNodeId: signal<string | null>(null),
  };
}

/** The current value of the autocomplete input. */
export const autocompleteInputValue = (state: AutocompleteState): string => state.inputValue.value();

/** Sets the value of the autocomplete input. */
export function setAutocompleteInputValue(state: AutocompleteState, value: string): void {
  setControlledValue(state.inputValue, value);
}

/** Sets the id of the current aria-activedescendant of the autocomplete input. */
export function setFocusedNodeId(state: AutocompleteState, value: string | null): void {
  state.focusedNodeId.set(value);
}
