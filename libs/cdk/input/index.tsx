// Ported from react-aria-components Input (packages/react-aria-components/src/Input.tsx), Apache-2.0, © Adobe.
// A native `<input>` with hover / focus / focus-visible state (`data-hovered`, `data-focused`,
// `data-focus-visible`, `data-disabled`, `data-invalid`); fields provide `InputContext`.
// Rivet: props merged with `InputContext` (`contextProps`); render props are accessors
// (`isHovered()`), `class` / `style` functions run inside bindings; state attributes are written by
// bindings over the hover / focus-ring signals, so nothing runs before the first interaction.
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, InputRenderProps)` instead of the default element. Deviations: not a hideable collection component.
// - `autoFocus`: React focuses an `autoFocus` input when it mounts (also one created later, e.g. inside an opened popover); the native
//   attribute only acts at page load, so a `clientEffect` focuses the element once (`focusSafely`). Only with `autoFocus` (the ref is
//   then merged with an own `ref()`); the default path is unchanged.
import { createContext, untrack } from "@rivetjs/reactivity";
import { hasLive, liveAt, liveOmit, readOnce } from "../utils/live.tsx";
import { liveRenderProps, slottedContext } from "../slots/index.tsx";
import { mergeIds } from "../utils/id.ts";
import { clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import { focusSafely } from "../focus/index.ts";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { mergeInto } from "../interactions/merge-props.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import {
  contextProps,
  renderProps,
  type ClassNameOrFunction,
  type ContextValue,
  type AccessorProps,
  type HTMLProps,
  mergeRefValues,
  type RefValue,
  type SlotProps,
  type StyleOrFunction,
} from "../slots/index.tsx";
import type { HoverEvents } from "../utils/types.ts";

import { isHiddenPart } from "../collections/hidden.ts";
import { slotProbing } from "#server";

export interface InputRenderProps {
  /**
   * Whether the input is currently hovered with a mouse.
   *
   * @selector [data-hovered]
   */
  isHovered: () => boolean;
  /**
   * Whether the input is focused, either via a mouse or keyboard.
   *
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the input is keyboard focused.
   *
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
  /**
   * Whether the input is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the input is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
}

export interface InputProps extends AccessorProps<HTMLProps<"input">, "autoFocus">, HoverEvents, SlotProps, DOMRenderProps<"input", InputRenderProps> {
  /**
   * The CSS class of the element. A function may be provided to compute the class based on component state.
   *
   * @default "rv-Input"
   */
  class?: ClassNameOrFunction<InputRenderProps>;
  /** The inline style of the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<InputRenderProps>;
  /** Temporary text that occupies the text input when it is empty. */
  placeholder?: string;
  ref?: RefValue<HTMLInputElement>;
}

export const InputContext = createContext<ContextValue<InputProps, HTMLInputElement>>({});

/** An input allows a user to input text. */
export function Input(props: InputProps) {
  // RAC createHideableComponent: nothing in the collection build pass (its context providers are absent).
  if (slotProbing) {
    // A field's server slot probe: an own `id` merges into the field's input id now (RA mergeIds), so the Label that
    // renders before this Input writes `for` = this id, as the client render does (the real render merges too late).
    const own = (props as { id?: unknown }).id;
    const ctxId = (slottedContext(InputContext, props.slot) as { id?: unknown } | null | undefined)?.id;
    if (typeof own === "string" && own && typeof ctxId === "string" && ctxId) mergeIds(ctxId, own);
    return null;
  }
  if (isHiddenPart()) return null;
  const [merged, contextRef] = contextProps(props, props.ref, InputContext);
  let ref = contextRef;
  if (read((merged as InputProps).autoFocus)) {
    const own = createRef<HTMLInputElement>();
    ref = mergeRefValues(own, contextRef);
    let done = false;
    clientEffect(() => {
      const el = own();
      if (!done && el && untrack(() => el.ownerDocument.activeElement) !== el) untrack(() => focusSafely(el));
      done = true;
    });
  }
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
  } = readOnce(merged as InputProps & Record<string, unknown>, ["onHoverStart", "onHoverEnd", "onHoverChange", "class", "style", "slot", "render"] as const);
  const rest = liveOmit(
    merged as InputProps & Record<string, unknown>,
    ["onHoverStart", "onHoverEnd", "onHoverChange", "class", "style", "slot", "render"] as const,
  ) as Record<string, unknown>;
  // Context values may be accessors (fields provide reactive `aria-invalid`, `disabled`, …): read in bindings.
  const disabledValue = liveAt(rest, "disabled");
  const invalidValue = liveAt(rest, "aria-invalid");
  const disabled = () => !!read(disabledValue);
  const isInvalid = () => {
    const v = read(invalidValue);
    return !!v && v !== "false";
  };
  const hover = hoverProps({ onHoverStart, onHoverEnd, onHoverChange, isDisabled: disabled }, rest);
  const isHovered = hover.isHovered;
  const { isFocused, isFocusVisible, focusProps } = useFocusRing({
    isTextInput: true,
    autoFocus: untrack(() => read(rest.autoFocus as MaybeAccessor<boolean | undefined>)),
  });
  const rp = renderProps<InputRenderProps>(
    {
      class: className,
      style,
      values: { isHovered, isFocused, isFocusVisible, isDisabled: disabled, isInvalid },
      defaultClassName: "rv-Input",
    },
    live ? (liveRenderProps(merged as object, ["class", "style"]) as never) : undefined,
  );
  // Accessor values are resolved by the element spread (ACCESSOR RULE).
  // `rest` is this part's own (read no more below): the static path merges into it in place.
  const domProps = mergeInto(rest, focusProps, hover.hoverProps) as Record<string, unknown>;
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
      } as never,
      { isHovered, isFocused, isFocusVisible, isDisabled: disabled, isInvalid },
    );
  return (
    <input
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
    />
  );
}
