// Ported from react-aria-components Keyboard (packages/react-aria-components/src/Keyboard.tsx), Apache-2.0, © Adobe.
// A keyboard shortcut (`<kbd dir="ltr">`); menu items provide `KeyboardContext` (slot `keyboard`).
// Rivet: props merged with `KeyboardContext` (`contextProps`). `render` (RAC DOMRenderProps): given, the attributes object (`ref`, `class`, `style`, `children`) goes to `render(attrs, undefined)` instead of the default element; the default path is the compiled element.
import { createContext } from "@rivetjs/reactivity";
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

export interface KeyboardProps extends HTMLProps<"kbd">, SlotProps, DOMRenderProps<"kbd", undefined> {
  class?: string;
  style?: StyleObject;
  ref?: RefValue<HTMLElement>;
  /** Content; a function (not lazy JSX) is reactive content, rendered in a binding (e.g. a context-provided `children: () => title`). */
  children?: Content | (() => Content);
}

export const KeyboardContext = resumableContext(createContext<ContextValue<KeyboardProps, HTMLElement>>({}, { id: "rv-keyboard" }));

export function Keyboard(props: KeyboardProps) {
  // A menu item's server slot probe (`probeSlots`): mark the shortcut slot id this part takes, render nothing.
  if (slotProbing) return (probeSlot(props, KeyboardContext), null);
  // RAC createHideableComponent: nothing in the collection build pass (its context providers are absent).
  if (isHiddenPart()) return null;
  const [merged, ref] = contextProps(props, props.ref, KeyboardContext);
  const { children, class: className, style, slot, dir = "ltr", render, ...domProps } = merged as KeyboardProps & Record<string, unknown>;
  const s = slot ?? undefined;
  if (render)
    return render(
      {
        ...domProps,
        style: (typeof style === "function" ? (style as () => StyleObject)() : style) as never,
        dir,
        slot: s,
        ref: ref as never,
        class: className,
        children: slotChildren(children),
      } as never,
      undefined,
    );
  return (
    <kbd
      {...domProps}
      style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never}
      dir={dir as "ltr"}
      slot={s}
      ref={ref as never}
      class={className}
    >
      {renderSlot(children)}
    </kbd>
  );
}
