// Ported from react-stately useSearchFieldState (packages/react-stately/src/searchfield/useSearchFieldState.ts),
// Apache-2.0, © Adobe.
// Rivet:
// - `value` plain = controlled (only reported through `onChange`), Signal = two-way, accessor (`() => text`,
//   e.g. an Autocomplete's `FieldInputContext` value) = controlled and read live; else uncontrolled
//   (all via `controllable`; uncontrolled = region state). Read with `searchFieldValue(state)`, write with `setSearchFieldValue`.
// - state = signals + JSON + the caller's `onChange`: serializes on resumed pages.
import type { Signal } from "@rivetjs/reactivity";
import { controllable, setControlledValue, type ControlledState } from "../interactions/controllable.ts";

export interface SearchFieldStateProps {
  /** The current value (controlled): a plain value, a two-way Signal, or an accessor read live. */
  value?: string | Signal<string> | (() => string);
  /** The default value (uncontrolled). */
  defaultValue?: string;
  /** Handler that is called when the value changes. */
  onChange?: (value: string) => void;
}

export interface SearchFieldState {
  /** The current value of the search field. */
  readonly value: ControlledState<string>;
}

function toString(val: unknown): string | undefined {
  if (val == null) {
    return;
  }

  return String(val);
}

/** Provides state management for a search field. */
export function createSearchFieldState(props: SearchFieldStateProps): SearchFieldState {
  const value = props.value;
  return {
    // Signals / accessors pass through (`controllable`); plain values stringify like upstream.
    value: controllable<string>(typeof value === "function" ? value : toString(value), toString(props.defaultValue) || "", props.onChange),
  };
}

/** The current value of the search field. */
export const searchFieldValue = (state: SearchFieldState): string => state.value.value();

/** Sets the value of the search field. */
export function setSearchFieldValue(state: SearchFieldState, value: string): void {
  setControlledValue(state.value, value);
}
