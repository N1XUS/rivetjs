// Ported from react-aria useFocusable / Focusable / FocusableProvider / FocusableContext
// (packages/react-aria/src/interactions/useFocusable.tsx), Apache-2.0, © Adobe.
// Makes an element focusable and capable of auto focus; `FocusableContext` passes DOM props (e.g. a
// TooltipTrigger's `aria-describedby` + focus handlers) to the nearest focusable child.
// Rivet:
// - `useFocusable(props, ref)` → `focusableProps(props, ref?)` returning RA's `focusableProps` bag
//   (naming convention); handlers are resumable (focusProps / keyboardProps bags).
// - autoFocus: a `clientEffect` focuses the ref'd element once (`focusSafely`), only when `autoFocus`.
// - `FocusableContext` is registered for resume (id `rv-focusable`); its `ref` is a Rivet ref that the
//   consumer's ref is synced to (RA `useSyncRef`) through `mergeRefValues`.
// - Deviation: `<Focusable>` cannot clone its child (compiled templates): the child is a render
//   function receiving the merged props, which it spreads on its element and whose `ref` it passes
//   (`{(p) => <span {...p} ref={p.ref} role="button">…</span>}`: a spread never sets `ref`). Dev checks (child focusable / interactive
//   role) run in a dev-only client effect.
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { Provider as ContextProvider, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { focusProps } from "../interactions/focus.tsx";
import { keyboardProps } from "../interactions/keyboard.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { isFocusable } from "../interactions/utils.ts";
import { mergeRefValues, type RefValue } from "../slots/index.tsx";
import type { FocusableDOMProps, FocusableProps } from "../utils/types.ts";
import { focusSafely } from "./index.ts";

export interface FocusableOptions<T extends Element = Element> extends FocusableProps<T>, FocusableDOMProps {
  /** Whether focus should be disabled. */
  isDisabled?: boolean;
}

export interface FocusableProviderProps {
  /** The child element to provide DOM props to. */
  children?: Content;
  ref?: RefValue<Element>;
  [attribute: string]: unknown;
}

export interface FocusableContextValue {
  ref?: RefValue<Element>;
  [attribute: string]: unknown;
}

/** DOM props for the nearest focusable child (RA `FocusableContext`, exported for collections). */
export const FocusableContext = resumableContext(createContext<FocusableContextValue | null>(null, { id: "rv-focusable" }));

/** Provides DOM props to the nearest focusable child (RA `FocusableProvider`). */
export function FocusableProvider(props: FocusableProviderProps) {
  const { children, ref, ...otherProps } = props;
  const value: FocusableContextValue = { ...otherProps, ref: ref ?? createRef<Element>() };
  return (
    <ContextProvider token={FocusableContext} value={value}>
      {renderSlot(children)}
    </ContextProvider>
  );
}

/**
 * Used to make an element focusable and capable of auto focus (RA `useFocusable(props, domRef).focusableProps`).
 * Put `ref` (when given) on the element: autoFocus and the context's ref sync go through it.
 */
export function focusableProps(props: FocusableOptions, ref?: RefValue<Element>): Record<string, unknown> {
  const focus = focusProps(props as Parameters<typeof focusProps>[0]);
  const keyboard = keyboardProps(props as Parameters<typeof keyboardProps>[0]);
  const interactions = mergeProps(focus.focusProps, keyboard.keyboardProps);
  const context = useContext(FocusableContext) || {};
  const { ref: contextRef, ...domProps } = context;
  const interactionProps = props.isDisabled ? {} : domProps;
  const elementRef = mergeRefValues(ref, contextRef);

  if (props.autoFocus && elementRef) {
    const target = elementRef;
    let done = false;
    clientEffect(() => {
      const el = typeof target === "function" ? (target as () => Element | undefined)() : (target as { current: Element | null }).current;
      if (!done && el) untrack(() => focusSafely(el as HTMLElement));
      done = true;
    });
  }

  // Always set a tabIndex so that Safari allows focusing native buttons and inputs.
  let tabIndex: number | undefined = props.excludeFromTabOrder ? -1 : 0;
  if (props.isDisabled) tabIndex = undefined;

  const out = mergeProps({ ...interactions, tabIndex }, interactionProps);
  if (elementRef) out.ref = elementRef;
  return out;
}

export interface FocusableComponentProps extends FocusableOptions {
  /** Render function of the focusable element: spread the props (incl. `ref`) on it. */
  children: (props: Record<string, unknown>) => Content;
  ref?: RefValue<Element>;
}

const isDev = (): boolean => (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV === "development";

const INTERACTIVE_ROLES =
  /^(application|button|checkbox|combobox|gridcell|link|menuitem|menuitemcheckbox|menuitemradio|option|radio|searchbox|separator|slider|spinbutton|switch|tab|tabpanel|textbox|treeitem|img|meter|progressbar)$/;

/** Makes its child focusable (RA `<Focusable>`); see the header for the render-function child. */
export function Focusable(props: FocusableComponentProps) {
  const { children, ref, ...options } = props;
  const element = ref ?? createRef<Element>();
  const merged = focusableProps(options, element);
  if (isDev()) {
    const isDisabled = options.isDisabled;
    clientEffect(() => {
      const el = typeof element === "function" ? (element as () => Element | undefined)() : (element as { current: Element | null }).current;
      if (!el) return console.error("<Focusable> child must forward its ref to a DOM element.");
      untrack(() => {
        if (!isDisabled && !isFocusable(el, { skipVisibilityCheck: true }))
          return console.warn("<Focusable> child must be focusable. Please ensure the tabIndex prop is passed through.");
        if (!/^(button|input|select|textarea|a|area|summary|img|svg)$/.test(el.localName)) {
          const role = el.getAttribute("role");
          if (!role) console.warn("<Focusable> child must have an interactive ARIA role.");
          else if (!INTERACTIVE_ROLES.test(role)) console.warn(`<Focusable> child must have an interactive ARIA role. Got "${role}".`);
        }
      });
    });
  }
  return renderSlot(children, merged);
}
