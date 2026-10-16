// Rivet addition (no React Aria / Angular CDK counterpart): a styled native `<select>` as a field part, built like RAC
// `TextArea` (`../text-area/index.tsx`): hover / focus / focus-visible state (`data-hovered`, `data-focused`,
// `data-focus-visible`, `data-disabled`, `data-invalid`), props merged with the field context, accessor render props.
// - Field: inside a cdk `TextField` the select takes the field's `TextAreaContext` bag (id, `name`, `required` /
//   `aria-required`, `disabled`, `aria-invalid`, `aria-describedby` slot ids, `value` accessor, `input` / `change` / `invalid` /
//   focus handlers: the same attributes RAC gives a textarea, no `type` / `pattern`), so Label `for`, Description / FieldError
//   ids, native + aria validation, Form `validationErrors` and form reset work as for a text field. Standalone it is a plain
//   `<select>` with the state attributes.
// - `NativeSelectOption` marks `selected` from the select's current value (`NativeSelectValueContext`): the server markup shows
//   the value (a `<select>` has no `value` attribute in HTML), and the client keeps the property in sync through the `value`
//   binding. `NativeSelectOptGroup` = `<optgroup>`.
// - Used by `@rivetjs/ui/native-select` (feature set inspired by HeroUI Pro's public docs).
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { hasLive, liveAt, liveOmit, readOnce } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Provider } from "@rivetjs/runtime/dom";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import type { InputRenderProps } from "../input/index.tsx";
import { TextAreaContext } from "../text-area/index.tsx";
import {
  resumableContext,
  contextProps,
  renderProps,
  type ClassNameOrFunction,
  type ContextValue,
  type AccessorProps,
  type HTMLProps,
  type RefValue,
  type SlotProps,
  type StyleOrFunction,
} from "../slots/index.tsx";
import type { HoverEvents } from "../utils/types.ts";
import { isHiddenPart } from "../collections/hidden.ts";
import { slotProbing } from "#server";

export type { InputRenderProps } from "../input/index.tsx";

export interface NativeSelectProps
  extends Omit<AccessorProps<HTMLProps<"select">, "autoFocus">, "children" | "value">, HoverEvents, SlotProps, DOMRenderProps<"select", InputRenderProps> {
  /** The `<option>` / `<optgroup>` children. */
  children?: Content;
  /** The current value (standalone; inside a TextField the field's value wins). A plain value or an accessor. */
  value?: string | (() => string);
  /**
   * The CSS class of the element. A function may be provided to compute the class based on component state.
   *
   * @default "rv-NativeSelect"
   */
  class?: ClassNameOrFunction<InputRenderProps>;
  /** The inline style of the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<InputRenderProps>;
  ref?: RefValue<HTMLSelectElement>;
}

/** Props for the selects inside a component, optionally per `slot` (none provide it in the cdk: fields use `TextAreaContext`). */
export const NativeSelectContext = resumableContext(createContext<ContextValue<NativeSelectProps, HTMLSelectElement>>({}, { id: "rv-native-select" }));

/** The select's current value for its options (`selected`). */
export const NativeSelectValueContext = resumableContext(createContext<{ value?: () => string | undefined }>({}, { id: "rv-native-select-value" }));

/** A native `<select>` field part with hover / focus / validation state. */
export function NativeSelect(props: NativeSelectProps) {
  // RAC createHideableComponent: nothing in the collection build pass (its context providers are absent).
  if (slotProbing || isHiddenPart()) return null;
  const [own, ownRef] = contextProps(props, props.ref, NativeSelectContext);
  // Inside a TextField: the field's select bag (= its textarea bag).
  const [merged, ref] = contextProps(own, ownRef, TextAreaContext as never) as unknown as [
    NativeSelectProps & Record<string, unknown>,
    RefValue<HTMLSelectElement>,
  ];
  // Live props (P5): read-once keys untracked, the rest forwarded unread (`liveOmit`); class / style from a live view.
  const live = hasLive(merged);
  const {
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    class: className,
    style,
    slot,
    render,
    children,
  } = readOnce(merged, ["onHoverStart", "onHoverEnd", "onHoverChange", "class", "style", "slot", "render", "children"] as const);
  const rest = liveOmit(merged, ["onHoverStart", "onHoverEnd", "onHoverChange", "class", "style", "slot", "render", "children"] as const) as Record<
    string,
    unknown
  >;
  // Context values may be accessors (fields provide reactive `aria-invalid`, `value`, …): read in bindings.
  const disabledValue = liveAt(rest, "disabled");
  const invalidValue = liveAt(rest, "aria-invalid");
  const valueValue = liveAt(rest, "value");
  const disabled = () => !!read(disabledValue);
  const isInvalid = () => {
    const v = read(invalidValue);
    return !!v && v !== "false";
  };
  const hover = hoverProps({ onHoverStart, onHoverEnd, onHoverChange }, rest);
  const isHovered = hover.isHovered;
  const { isFocused, isFocusVisible, focusProps } = useFocusRing({ autoFocus: untrack(() => read(rest.autoFocus as MaybeAccessor<boolean | undefined>)) });
  const values = { isHovered, isFocused, isFocusVisible, isDisabled: disabled, isInvalid };
  const rp = renderProps<InputRenderProps>(
    { class: className as never, style: style as never, values, defaultClassName: "rv-NativeSelect" },
    live ? (liveRenderProps(merged as object, ["class", "style"]) as never) : undefined,
  );
  // Field bags written for a textarea: drop the text-only attributes a select does not take.
  for (const key of ["placeholder", "maxLength", "minLength", "readOnly", "autoCapitalize", "autoCorrect", "spellCheck", "inputMode", "enterKeyHint"])
    delete rest[key];
  const domProps = mergeProps(rest, focusProps, hover.hoverProps) as Record<string, unknown>;
  const valueContext = { value: () => read(valueValue as string | (() => string) | undefined) };
  const s = slot ?? undefined;
  if (render)
    return render(
      {
        ...domProps,
        slot: s,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        "data-focused": () => isFocused() || undefined,
        "data-disabled": () => disabled() || undefined,
        "data-hovered": () => isHovered() || undefined,
        "data-focus-visible": () => isFocusVisible() || undefined,
        "data-invalid": () => isInvalid() || undefined,
        children: () => (
          <Provider token={NativeSelectValueContext} value={valueContext}>
            {children}
          </Provider>
        ),
      } as never,
      values,
    );
  return (
    <select
      {...domProps}
      slot={s}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      data-focused={isFocused() || undefined}
      data-disabled={disabled() || undefined}
      data-hovered={isHovered() || undefined}
      data-focus-visible={isFocusVisible() || undefined}
      data-invalid={isInvalid() || undefined}
    >
      <Provider token={NativeSelectValueContext} value={valueContext}>
        {children}
      </Provider>
    </select>
  );
}

export interface NativeSelectOptionProps extends Omit<HTMLProps<"option">, "children" | "selected"> {
  /** The submitted value (and the key the select's value is compared with). */
  value: string;
  children?: Content;
  class?: string;
  ref?: RefValue<HTMLOptionElement>;
}

/** An `<option>`; `selected` follows the enclosing select's value. */
export function NativeSelectOption(props: NativeSelectOptionProps) {
  const ctx = useContext(NativeSelectValueContext);
  const current = ctx.value;
  const { value, children, ref, ...rest } = props;
  return (
    <option {...(rest as Record<string, unknown>)} ref={ref as never} value={value} selected={current ? current() === value : undefined}>
      {children}
    </option>
  );
}

export interface NativeSelectOptGroupProps extends Omit<HTMLProps<"optgroup">, "children"> {
  label: string;
  children?: Content;
  class?: string;
  ref?: RefValue<HTMLOptGroupElement>;
}

/** An `<optgroup>`. */
export function NativeSelectOptGroup(props: NativeSelectOptGroupProps) {
  const { children, ref, ...rest } = props;
  return (
    <optgroup {...(rest as Record<string, unknown>)} ref={ref as never}>
      {children}
    </optgroup>
  );
}
