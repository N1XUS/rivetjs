// Ported from react-aria-components Header (packages/react-aria-components/src/Header.tsx), Apache-2.0, © Adobe.
// Rivet: props merged with `HeaderContext` (`contextProps`); a collection leaf
// (`createLeafComponent(HeaderNode, …)` from `../collections/components.tsx`): inside a collection host it
// renders in place (live) or registers a header node (build mode). `render` (RAC DOMRenderProps): given, the attributes object (`ref`, `class`, `style`, `children`) goes to `render(attrs, undefined)` instead of the default element; the default path is the compiled element.
import { createContext, untrack } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { slotChildren, type DOMRenderProps } from "../utils/render.ts";
import { HeaderNode } from "../collections/base.ts";
import { createLeafComponent } from "../collections/components.tsx";
import { contextProps, type ContextValue, type HTMLProps, type RefValue, type SlotProps, type StyleObject } from "../slots/index.tsx";
import { hasLive } from "../utils/live.tsx";
import { liveElement } from "../utils/live-element.tsx";

export interface HeaderProps extends HTMLProps<"header">, SlotProps, DOMRenderProps<"header", undefined> {
  /** @default "rv-Header" */
  class?: string;
  style?: StyleObject;
  ref?: RefValue<HTMLElement>;
  /** Content; a function (not lazy JSX) is reactive content, rendered in a binding (e.g. a context-provided `children: () => title`). */
  children?: Content | (() => Content);
}

export const HeaderContext = createContext<ContextValue<HeaderProps, HTMLElement>>({});

export const Header = /*#__PURE__*/ createLeafComponent<HeaderProps>(HeaderNode, function Header(props: HeaderProps, forwardedRef: unknown) {
  const [merged, ref] = contextProps(props, forwardedRef as RefValue<HTMLElement> | undefined, HeaderContext);
  // Live props (P5): class / style / children live (one `Dynamic` element).
  if (hasLive(merged) && !untrack(() => merged.render)) return untrack(() => liveElement(merged as never, ref, "header", "rv-Header"));
  const { children, class: className, style, slot, render, ...domProps } = merged as HeaderProps & Record<string, unknown>;
  const cls = className ?? "rv-Header";
  const s = slot ?? undefined;
  if (render)
    return render(
      {
        ...domProps,
        style: (typeof style === "function" ? (style as () => StyleObject)() : style) as never,
        slot: s,
        ref: ref as never,
        class: cls,
        children: slotChildren(children),
      } as never,
      undefined,
    );
  return (
    <header {...domProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={ref as never} class={cls}>
      {renderSlot(children)}
    </header>
  );
}) as (props: HeaderProps) => unknown;
