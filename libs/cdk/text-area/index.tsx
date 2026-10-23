// Ported from react-aria-components TextArea (packages/react-aria-components/src/TextArea.tsx), Apache-2.0, © Adobe.
// A native `<textarea>` with hover / focus / focus-visible state (`data-hovered`, `data-focused`,
// `data-focus-visible`, `data-disabled`, `data-invalid`); fields provide `TextAreaContext`.
// Rivet: as `../input/index.tsx` (accessor render props, bindings over hover / focus-ring signals).
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, InputRenderProps)` instead of the default element.
import { createContext, untrack } from "@rivetjs/reactivity";
import { hasLive, liveAt, liveOmit, readOnce } from "../utils/live.tsx";
import { liveRenderProps, slottedContext } from "../slots/index.tsx";
import { mergeIds } from "../utils/id.ts";
import { useFocusRing } from "../focus/focus-ring.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import type { InputRenderProps } from "../input/index.tsx";
import {
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

export interface TextAreaProps extends AccessorProps<HTMLProps<"textarea">, "autoFocus">, HoverEvents, SlotProps, DOMRenderProps<"textarea", InputRenderProps> {
  /**
   * The CSS class of the element. A function may be provided to compute the class based on component state.
   *
   * @default "rv-TextArea"
   */
  class?: ClassNameOrFunction<InputRenderProps>;
  /** The inline style of the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<InputRenderProps>;
  ref?: RefValue<HTMLTextAreaElement>;
}

export const TextAreaContext = createContext<ContextValue<TextAreaProps, HTMLTextAreaElement>>({});

/** A textarea allows a user to input multi-line text. */
export function TextArea(props: TextAreaProps) {
  // RAC createHideableComponent: nothing in the collection build pass (its context providers are absent).
  if (slotProbing) {
    // A field's server slot probe: an own `id` merges into the field's input id now (RA mergeIds, as `Input`), so the
    // Label that renders before this TextArea writes `for` = this id.
    const own = (props as { id?: unknown }).id;
    const ctxId = (slottedContext(TextAreaContext, props.slot) as { id?: unknown } | null | undefined)?.id;
    if (typeof own === "string" && own && typeof ctxId === "string" && ctxId) mergeIds(ctxId, own);
    return null;
  }
  if (isHiddenPart()) return null;
  const [merged, ref] = contextProps(props, props.ref, TextAreaContext);
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
  } = readOnce(merged as TextAreaProps & Record<string, unknown>, ["onHoverStart", "onHoverEnd", "onHoverChange", "class", "style", "slot", "render"] as const);
  const rest = liveOmit(
    merged as TextAreaProps & Record<string, unknown>,
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
  // RAC: hover props without `isDisabled` — the textarea's own `disabled` is not passed as `isDisabled`.
  const hover = hoverProps({ onHoverStart, onHoverEnd, onHoverChange }, rest);
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
      defaultClassName: "rv-TextArea",
    },
    live ? (liveRenderProps(merged as object, ["class", "style"]) as never) : undefined,
  );
  // Accessor values are resolved by the element spread (ACCESSOR RULE).
  const domProps = mergeProps(rest, focusProps, hover.hoverProps) as Record<string, unknown>;
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
    <textarea
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
