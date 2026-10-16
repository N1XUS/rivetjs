// Ported from react-aria-components Text (packages/react-aria-components/src/Text.tsx), Apache-2.0, © Adobe.
// Rivet: props merged with `TextContext` (`contextProps`; fields provide `{ slots: { description, errorMessage } }`
// with the part ids); `span` / `div` / `p` are compiled branches, other `elementType`s render through
// `Dynamic` (no resumable event handlers on those). `render` (RAC DOMRenderProps): given, the attributes object goes to `render(attrs, undefined)`; the default path is the compiled element. Deviations: not a hideable
// collection component (`createHideableComponent`: Rivet collections do not render parts twice).
import { createContext, untrack } from "@rivetjs/reactivity";
import { Dynamic } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { slotChildren, type DOMRenderProps } from "../utils/render.ts";
import {
  resumableContext,
  contextProps,
  probeSlot,
  type ContextValue,
  type HTMLProps,
  type RefValue,
  type SlotProps,
  type StyleObject,
} from "../slots/index.tsx";
import { isHiddenPart } from "../collections/hidden.ts";
import { slotProbing } from "#server";
import { hasLive } from "../utils/live.tsx";
import { liveElement } from "../utils/live-element.tsx";

export interface TextProps extends HTMLProps<"span">, SlotProps, DOMRenderProps<"span", undefined> {
  /** @default "rv-Text" */
  class?: string;
  style?: StyleObject;
  /** @default "span" */
  elementType?: string;
  ref?: RefValue<HTMLElement>;
  /** Content; a function (not lazy JSX) is reactive content, rendered in a binding (e.g. a context-provided `children: () => title`). */
  children?: Content | (() => Content);
}

export const TextContext = resumableContext(createContext<ContextValue<TextProps, HTMLElement>>({}, { id: "rv-text" }));

export function Text(props: TextProps) {
  // A field's server slot probe (`probeSlots`; browser: the constant `false`): mark the description / errorMessage slot id
  // this part takes, render nothing. RAC createHideableComponent: nothing in the collection build pass.
  if (slotProbing) return (probeSlot(props, TextContext), null);
  if (isHiddenPart()) return null;
  const [merged, ref] = contextProps(props, props.ref, TextContext);
  // Live props (P5): class / style / children live (one `Dynamic` element); `elementType` read once.
  if (hasLive(merged)) {
    const live = untrack(() => (merged.render ? null : ((merged.elementType as string | undefined) ?? "span")));
    if (live) return untrack(() => liveElement(merged as never, ref, live, "rv-Text"));
  }
  const { elementType = "span", children, class: className, style, slot, render, ...domProps } = merged as TextProps & Record<string, unknown>;
  const cls = className ?? "rv-Text";
  const s = slot ?? undefined;
  const r = ref as never;
  if (render)
    return render(
      {
        ...domProps,
        style: (typeof style === "function" ? (style as () => StyleObject)() : style) as never,
        slot: s,
        ref: r,
        class: cls,
        children: slotChildren(children),
      } as never,
      undefined,
    );
  if (elementType === "span")
    return (
      <span {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </span>
    );
  if (elementType === "div")
    return (
      <div {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </div>
    );
  if (elementType === "p")
    return (
      <p {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </p>
    );
  // `style` only when set: the server `Dynamic` rejects the `style` attribute name (even with an `undefined` value), so an unset
  // style must not be a key (ui `Typography` renders `h1`…`h6` / `code` through this branch).
  const dynamicStyle = style === undefined ? {} : { style: (typeof style === "function" ? (style as () => StyleObject)() : style) as never };
  return (
    <Dynamic component={elementType} {...domProps} {...dynamicStyle} slot={s} ref={r} class={cls}>
      {renderSlot(children)}
    </Dynamic>
  );
}
