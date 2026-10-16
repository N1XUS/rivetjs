// Ported from React Aria (@react-aria/select HiddenSelect.tsx: HiddenSelect, useHiddenSelect), Apache-2.0, © Adobe.
//
// A hidden native <select> (server-rendered, so the form value posts before any JS runs) for browser
// autofill, mobile form navigation and native form submission / validation. Over 300 items: hidden
// inputs instead (`<input type="text" hidden>` with native validation, so `required` blocks submit).
import { For } from "@rivetjs/runtime/dom";
import { untrack } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { visuallyHidden } from "../a11y/index.ts";
import { validityError } from "../form/behaviour.ts";
import { isSelectRequired, selectCollection, selectedKeys, selectItems, type SelectionMode, type SelectState } from "../state/select.ts";
import { hiddenId, hiddenSelectChange, hiddenSelectInvalid, isValueKey, selectDisabled } from "./behaviour.tsx";

export interface AriaHiddenSelectProps {
  /** Describes the type of autocomplete functionality the input should provide if any. */
  autoComplete?: string;
  /** The text label for the select. */
  label?: Content;
  /** HTML form input name. */
  name?: string;
  /** The `<form>` element to associate the input with (its id). */
  form?: string;
  /** Sets the disabled state of the select and input (an accessor stays live). */
  isDisabled?: boolean | (() => boolean);
}

export interface HiddenSelectProps<M extends SelectionMode = "single"> extends AriaHiddenSelectProps {
  /** State for the select. */
  state: SelectState<M>;
  /**
   * @internal Rivet: the select carries the `preload="visible"` resume directive (Select parts `render` root: the
   * directive is JSX-literal and cannot reach the user's root element, so the hidden select's handlers, which reach
   * the same state, plan the first click's dependency chunks while visible).
   */
  preloadVisible?: boolean;
}

/** useHiddenSelect `containerProps` style: visually hidden, fixed (prevents page scrolling). */
export const hiddenContainerStyle = { ...visuallyHidden, position: "fixed", top: "0", left: "0" } as const;

/**
 * Renders a hidden native `<select>` element, which can be used to support browser form autofill,
 * mobile form navigation, and native form submission.
 */
export function HiddenSelect<M extends SelectionMode = "single">(props: HiddenSelectProps<M>) {
  const state = props.state as unknown as SelectState<SelectionMode>;
  const name = props.name ?? state.name,
    form = props.form ?? state.form,
    isDisabled = props.isDisabled ?? selectDisabled(state);
  const native = state.validation.behavior === "native";
  const multiple = state.selectionMode === "multiple";
  // If the collection isn't too big, use a hidden <select> so that browser autofill works.
  if (untrack(() => selectCollection(state).size) <= 300) {
    const values = untrack(() => selectedKeys(state));
    // One option list for both select variants (with / without the preload directive).
    const options = () => (
      <>
        <option value="" label={"\u00A0"} selected={(!multiple && selectedKeys(state).length === 0) || undefined}>
          {"\u00A0"}
        </option>
        <For each={() => selectItems(state)} by={(item) => item.key}>
          {(item) => {
            const { key, label, textValue } = item();
            return (
              <option value={String(key)} selected={isValueKey(state, key) || undefined}>
                {textValue ?? label}
              </option>
            );
          }}
        </For>
        {/* The collection may be empty during the initial render: options for the current values
                  give the select its value immediately (FormData reads are consistent). */}
        {untrack(() => selectCollection(state).size) === 0 && name ? values.map((value) => <option value={String(value ?? "")} selected />) : null}
      </>
    );
    return (
      // Hidden from assistive technology; FocusScope never focuses inside (data-react-aria-prevent-focus).
      // Rivet: a `span` (RAC: `div`) so a Select can sit in phrasing content (`<p>`: a `<div>` start tag closes the paragraph
      // in the HTML parser); visually hidden + `position: fixed`, so the element type does not change the layout.
      <span
        style={hiddenContainerStyle}
        aria-hidden="true"
        data-react-aria-prevent-focus=""
        data-a11y-ignore="aria-hidden-focus"
        data-testid="hidden-select-container"
      >
        <label>
          {props.label}
          {props.preloadVisible ? (
            <select
              preload="visible"
              id={hiddenId(state)}
              tabIndex={-1}
              autoComplete={props.autoComplete}
              disabled={(typeof isDisabled === "function" ? isDisabled() : isDisabled) || undefined}
              multiple={multiple || undefined}
              required={(native && isSelectRequired(state)) || undefined}
              name={name}
              form={form}
              data-rv-error={validityError(state.validation)}
              onChange={(event) => hiddenSelectChange(state, event)}
              onInput={(event) => hiddenSelectChange(state, event)}
              onInvalid={(event) => hiddenSelectInvalid(state, event)}
            >
              {options()}
            </select>
          ) : (
            <select
              id={hiddenId(state)}
              tabIndex={-1}
              autoComplete={props.autoComplete}
              disabled={(typeof isDisabled === "function" ? isDisabled() : isDisabled) || undefined}
              multiple={multiple || undefined}
              required={(native && isSelectRequired(state)) || undefined}
              name={name}
              form={form}
              data-rv-error={validityError(state.validation)}
              onChange={(event) => hiddenSelectChange(state, event)}
              onInput={(event) => hiddenSelectChange(state, event)}
              onInvalid={(event) => hiddenSelectInvalid(state, event)}
            >
              {options()}
            </select>
          )}
        </label>
      </span>
    );
  }
  if (!name) return null;
  // Over 300 items: hidden inputs carry the value (at least one, for required submission).
  const values = () => {
    const keys = selectedKeys(state);
    return keys.length ? keys.map(String) : [""];
  };
  return (
    <For each={values} by={(value, index) => index}>
      {(value, index) =>
        native ? (
          <input
            id={index() === 0 ? hiddenId(state) : undefined}
            type="text"
            style={{ display: "none" }}
            autoComplete={props.autoComplete}
            name={name}
            form={form}
            disabled={(typeof isDisabled === "function" ? isDisabled() : isDisabled) || undefined}
            value={value()}
            required={(index() === 0 && isSelectRequired(state)) || undefined}
            data-rv-error={index() === 0 ? validityError(state.validation) : undefined}
            onInvalid={(event) => hiddenSelectInvalid(state, event)}
          />
        ) : (
          <input
            id={index() === 0 ? hiddenId(state) : undefined}
            type="hidden"
            autoComplete={props.autoComplete}
            name={name}
            form={form}
            disabled={(typeof isDisabled === "function" ? isDisabled() : isDisabled) || undefined}
            value={value()}
          />
        )
      }
    </For>
  );
}
