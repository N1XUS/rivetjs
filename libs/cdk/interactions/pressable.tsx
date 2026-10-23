// Ported from react-aria Pressable, PressResponder, ClearPressResponder
// (packages/react-aria/src/interactions/Pressable.tsx, PressResponder.tsx, context.ts), Apache-2.0, © Adobe.
// Rivet:
// - `PressResponder` provides `PressResponderContext` (press.tsx):
//   the nearest `pressProps` below merges those props (handlers chain, parent first) and calls `register`.
//   Its children render into a const before the provider returns, so the dev warning "rendered without
//   a pressable child" is a synchronous check after them on client renders (no effect). Server renders
//   never warn (RA warns in a `useEffect`, which never runs in SSR): server templates call slot-valued
//   holes (`<div>{props.children}</div>`) while serializing, after the check, so a trigger passed through
//   a wrapper registers too late (HeroUI ColorPicker root). `register` is an inline arrow over a plain
//   state object (resumable).
// - `ref`: the responder's ref, else the outer responder's (RA `useObjectRef(ref || prevContext?.ref)` +
//   `useSyncRef`), merged with `mergeRefValues`.
// - Deviation: `<Pressable>` cannot clone its child (compiled templates): the child is a render function
//   receiving the merged press + focusable props to spread on its element, passing `ref`
//   explicitly (`{(p) => <span {...p} ref={p.ref} role="button">…</span>}`: a spread never sets `ref`). Dev checks (child focusable / interactive
//   role) run in a dev-only client effect.
import { untrack, useContext } from "@rivetjs/reactivity";
import { Provider as ContextProvider, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { focusableProps, type FocusableOptions } from "../focus/focusable.tsx";
import { mergeRefValues, type RefValue } from "../slots/index.tsx";
import { mergeProps } from "./merge-props.tsx";
import { PressResponderContext, pressProps, type PressProps } from "./press.tsx";
import { DEV, isFocusable } from "./utils.ts";

export { PressResponderContext } from "./press.tsx";

export interface PressResponderProps extends PressProps {
  children?: Content;
  ref?: RefValue<Element>;
}

/** Passes press props to the nearest pressable child (`pressProps`) through context (RA `PressResponder`). */
export function PressResponder(props: PressResponderProps) {
  const { children, ref, ...rest } = props;
  const prevContext = useContext(PressResponderContext) as (PressProps & { register?: () => void; ref?: RefValue<Element> }) | null;
  const state = { isRegistered: false };
  const context = mergeProps(prevContext || {}, {
    ...rest,
    register: () => {
      state.isRegistered = true;
      if (prevContext) prevContext.register?.();
    },
  }) as PressProps & { register: () => void; ref?: RefValue<Element> };
  context.ref = mergeRefValues(ref, prevContext?.ref);
  return (
    <ContextProvider token={PressResponderContext} value={context}>
      {renderResponderChildren(children, state)}
    </ContextProvider>
  );
}

function renderResponderChildren(children: Content, state: { isRegistered: boolean }): Content {
  const content = renderSlot(children);
  if (!state.isRegistered && typeof document !== "undefined" && DEV) {
    console.warn("A PressResponder was rendered without a pressable child. Either spread pressProps, or wrap your DOM node with <Pressable> component.");
    state.isRegistered = true;
  }
  return content;
}

/** Stops press props of outer `PressResponder`s from reaching the children (RA `ClearPressResponder`). */
export function ClearPressResponder(props: { children?: Content }) {
  const children = props.children;
  const context = { register: () => {} };
  return (
    <ContextProvider token={PressResponderContext} value={context}>
      {renderSlot(children)}
    </ContextProvider>
  );
}

export interface PressableProps extends PressProps, Omit<FocusableOptions, "isDisabled"> {
  /** Render function of the pressable element: spread the props (incl. `ref`) on it. */
  children: (props: Record<string, unknown>) => Content;
  ref?: RefValue<Element>;
}

const INTERACTIVE_ROLES =
  /^(application|button|checkbox|combobox|gridcell|link|menuitem|menuitemcheckbox|menuitemradio|option|radio|searchbox|separator|slider|spinbutton|switch|tab|textbox|treeitem)$/;

/** Makes its child pressable and focusable (RA `<Pressable>`); see the header for the render-function child. */
export function Pressable(props: PressableProps) {
  const { children, ref, ...options } = props;
  // RA usePress syncs the responder's ref with the pressable element (`useSyncRef(context, ref)`).
  const responder = useContext(PressResponderContext) as { ref?: RefValue<Element> } | null;
  const element = mergeRefValues(ref ?? createRef<Element>(), responder?.ref)!;
  const press = pressProps(options as Parameters<typeof pressProps>[0]);
  const focusable = focusableProps(options as FocusableOptions, element);
  const merged = mergeProps(press.pressProps, focusable);
  merged.ref = focusable.ref ?? element;
  if (DEV) {
    const isDisabled = options.isDisabled;
    clientEffect(() => {
      const el = typeof element === "function" ? (element as () => Element | undefined)() : (element as { current: Element | null }).current;
      if (!el) return console.error("<Pressable> child must forward its ref to a DOM element.");
      untrack(() => {
        if (!isDisabled && !isFocusable(el, { skipVisibilityCheck: true }))
          return console.warn("<Pressable> child must be focusable. Please ensure the tabIndex prop is passed through.");
        if (!/^(button|input|select|textarea|a|area|summary)$/.test(el.localName)) {
          const role = el.getAttribute("role");
          if (!role) console.warn("<Pressable> child must have an interactive ARIA role.");
          else if (!INTERACTIVE_ROLES.test(role)) console.warn(`<Pressable> child must have an interactive ARIA role. Got "${role}".`);
        }
      });
    });
  }
  return renderSlot(children, merged);
}
