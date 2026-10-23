// Ported from react-aria-components Heading (packages/react-aria-components/src/Heading.tsx), Apache-2.0, © Adobe.
// Rivet: props merged with `HeadingContext` (`contextProps`, slots: `<Heading slot="title">` in a Dialog);
// one explicit branch per level (`h1`…`h6`: compiled templates). `render` (RAC DOMRenderProps): given, the attributes object (`ref`, `class`, `style`, `children`) goes to `render(attrs, undefined)` instead of the default element; the default path is the compiled element.
import { createContext, untrack } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { slotChildren, type DOMRenderProps } from "../utils/render.ts";
import { contextProps, type ContextValue, type HTMLProps, type RefValue, type SlotProps, type StyleObject } from "../slots/index.tsx";
import { hasLive } from "../utils/live.tsx";
import { liveElement } from "../utils/live-element.tsx";

export interface HeadingProps extends HTMLProps<"h3">, SlotProps, DOMRenderProps<"h3", undefined> {
  /** @default "rv-Heading" */
  class?: string;
  style?: StyleObject;
  /**
   * The heading level.
   *
   * @default 3
   */
  level?: number;
  ref?: RefValue<HTMLHeadingElement>;
  /** Content; a function (not lazy JSX) is reactive content, rendered in a binding (e.g. a context-provided `children: () => title`). */
  children?: Content | (() => Content);
}

export const HeadingContext = createContext<ContextValue<HeadingProps, HTMLHeadingElement>>({});

export function Heading(props: HeadingProps) {
  const [merged, ref] = contextProps(props, props.ref, HeadingContext);
  // Live props (P5): class / style / children live (one `Dynamic` element); `level` read once.
  if (hasLive(merged)) {
    const live = untrack(() => (merged.render ? null : "h" + (merged.level ?? 3)));
    if (live) return untrack(() => liveElement(merged as never, ref, live, "rv-Heading", ["level"]));
  }
  const { children, level = 3, class: className, style, slot, render, ...domProps } = merged as HeadingProps & Record<string, unknown>;
  const cls = className ?? "rv-Heading";
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
  if (level === 1)
    return (
      <h1 {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </h1>
    );
  if (level === 2)
    return (
      <h2 {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </h2>
    );
  if (level === 4)
    return (
      <h4 {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </h4>
    );
  if (level === 5)
    return (
      <h5 {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </h5>
    );
  if (level === 6)
    return (
      <h6 {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </h6>
    );
  return (
    <h3 {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
      {renderSlot(children)}
    </h3>
  );
}
