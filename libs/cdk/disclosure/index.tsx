// Ported from react-aria-components Disclosure.tsx (DisclosureGroup, Disclosure, DisclosurePanel;
// DisclosureGroupStateContext, DisclosureContext, DisclosureStateContext)
// (packages/react-aria-components/src/Disclosure.tsx), Apache-2.0, © Adobe.
//
// RAC composition: `<DisclosureGroup><Disclosure id><Heading><Button slot="trigger"/></Heading>
// <DisclosurePanel/></Disclosure>…</DisclosureGroup>`.
// Rivet:
// - state = `@rivetjs/cdk/state/disclosure` (react-stately useDisclosureState / useDisclosureGroupState):
//   `isExpanded` / `expandedKeys` are plain values (controlled) or Signals (two-way).
// - useDisclosure = `disclosureProps` (./behaviour.tsx): the trigger props reach the `<Button slot="trigger">`
//   through ButtonContext (accessor `aria-expanded`); the panel's `hidden` binding runs the upstream layout
//   effect (size variables, animations, `hidden="until-found"`) only on a change; the server renders the
//   final `hidden` / `aria-expanded` / `data-expanded`, so nothing runs before the first press.
// - Inside a group a Disclosure's `isExpanded` is the group's `expandedKeys.has(id)` (an accessor) and its
//   changes toggle the group key (RAC).
// - `data-focus-visible-within` is written by focusin / focusout handlers (RAC useFocusRing({within})).
// - `class` = RAC `className` (defaults `rv-DisclosureGroup`, `rv-Disclosure`, `rv-DisclosurePanel`).
// `render` (RAC DOMRenderProps) on DisclosureGroup / Disclosure / DisclosurePanel (their `<div>`): given, the attributes object goes to `render(attrs, renderProps)`.
// Deviations: DOM ids derive from one generated id per disclosure (`<id>-trigger`,
//   `<id>-panel`) instead of two `useId`s.
import { _regionState, createContext, getOwner, onCleanup, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { clientEffect, ref as createRef, type Ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import {
  DEFAULT_SLOT,
  Provider,
  contextProps,
  mergeRefValues,
  renderProps,
  type ClassNameOrFunction,
  type ContextValue,
  type RefValue,
  type SlotProps,
  type StyleOrFunction,
} from "../slots/index.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool, setDataAttr } from "../utils/data-attrs.tsx";
import { createId } from "../utils/id.ts";
import { isFocusVisible } from "../interactions/focus-visible.tsx";
import { ButtonContext } from "../button/index.tsx";
import {
  allowsMultiple,
  createDisclosureGroupState,
  createDisclosureState,
  closeAll,
  isGroupDisabled,
  isKeyExpanded,
  openAll,
  registerDisclosure,
  setExpandedKeys,
  toggleKey,
  unregisterDisclosure,
  type DisclosureGroupProps as StatelyDisclosureGroupProps,
  type DisclosureGroupState,
  type DisclosureState,
  type Key,
} from "../state/disclosure.ts";
import { disclosurePanelBeforeMatch, disclosurePanelStyle, disclosureProps, type DisclosureAria } from "./behaviour.tsx";
import { hasLive, liveAssign, liveKeys, liveOptions } from "../utils/live.tsx";

/** Group props that stay live (LIVE-SWEEP round 2); `expandedKeys` is controlled (`liveKeys`). */
const GROUP_LIVE = ["isDisabled", "allowsMultipleExpanded"] as const;
import { renderPropsOf } from "../slots/index.tsx";
import { read } from "../interactions/utils.ts";

export type { DisclosureGroupState, DisclosureState, Key };
export { allowsMultiple, createDisclosureGroupState, createDisclosureState, openAll, closeAll };
export { DetailsDisclosure, type DetailsDisclosureProps } from "./details.tsx";

const isFn = (v: unknown): boolean => typeof v === "function" && !isSlot(v);

// focus-visible-within (RAC useFocusRing({ within: true })): attribute + optional render-prop signal.
function focusWithinIn(e: FocusEvent, sig: Signal<boolean> | undefined): void {
  const el = e.currentTarget as HTMLElement;
  const visible = isFocusVisible();
  setDataAttr(el, "data-focus-visible-within", visible);
  sig?.set(visible);
}
function focusWithinOut(e: FocusEvent, sig: Signal<boolean> | undefined): void {
  const el = e.currentTarget as HTMLElement;
  if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
  setDataAttr(el, "data-focus-visible-within", false);
  sig?.set(false);
}

// =================================================================================================
// DisclosureGroup
// =================================================================================================

export interface DisclosureGroupRenderProps {
  /** Whether the disclosure group is disabled. @selector [data-disabled] */
  isDisabled: boolean;
  /** State of the disclosure group. */
  state: DisclosureGroupState;
}

export interface DisclosureGroupProps
  extends StatelyDisclosureGroupProps, SlotProps, DOMRenderProps<"div", DisclosureGroupRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class for the element. A function may be provided to compute the class based on component state. @default 'rv-DisclosureGroup' */
  class?: ClassNameOrFunction<DisclosureGroupRenderProps>;
  style?: StyleOrFunction<DisclosureGroupRenderProps>;
  children?: Content | ((values: DisclosureGroupRenderProps & { defaultChildren: Content | undefined }) => Content);
  id?: string;
  /** Rivet (Angular CDK accordion extra): an existing group state, e.g. for `openAll` / `closeAll` from outside the group. */
  state?: DisclosureGroupState;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `DisclosureGroupStateContext`. */
export const DisclosureGroupStateContext = resumableContext(createContext<DisclosureGroupState | null>(null, { id: "rv-disclosure-group-state" }));

const GROUP_OWNED = ["style"] as const;

/** A DisclosureGroup is a grouping of related disclosures, sometimes called an accordion (RAC `DisclosureGroup`). */
export function DisclosureGroup(props: DisclosureGroupProps) {
  // Live props: a controlled `expandedKeys={keys()}` stays live (accessor normalised to a Set; never written).
  const state =
    props.state ??
    createDisclosureGroupState(hasLive(props) ? liveAssign(liveOptions(props, GROUP_LIVE as never), { expandedKeys: liveKeys(props, "expandedKeys") }) : props);
  // Ensure only one item is expanded if allowsMultipleExpanded turns false (upstream effect; Signal `multi`).
  if (typeof state.allowsMultipleExpanded === "function")
    clientEffect(() => {
      const keys = state.expandedKeys();
      if (!allowsMultiple(state) && keys.size > 1) untrack(() => setExpandedKeys(state, new Set([keys.values().next().value!])));
    });
  const rp = renderPropsOf<DisclosureGroupRenderProps>(props, {
    defaultClassName: "rv-DisclosureGroup",
    values: { isDisabled: state.isDisabled, state },
  });
  const dom = globalDOMProps(props, GROUP_OWNED);
  const id = props.id,
    isDisabled = state.isDisabled,
    ref = props.ref as never;
  if (props.render) {
    const attrs = {
      ...dom,
      id,
      ref,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-disabled": () => dataBool(isGroupDisabled(state)),
      children: () => <Provider values={[[DisclosureGroupStateContext, state]]}>{() => rp.children()}</Provider>,
    };
    return props.render(attrs as never, { isDisabled, state });
  }
  return (
    <div {...dom} id={id} ref={ref} class={rp.class()} style={rp.style()} data-disabled={dataBool(isGroupDisabled(state))}>
      <Provider values={[[DisclosureGroupStateContext, state]]}>{() => rp.children()}</Provider>
    </div>
  );
}

// =================================================================================================
// Disclosure
// =================================================================================================

export interface DisclosureRenderProps {
  /** Whether the disclosure is expanded. @selector [data-expanded] */
  isExpanded: () => boolean;
  /** Whether the disclosure has keyboard focus. @selector [data-focus-visible-within] */
  isFocusVisibleWithin: () => boolean;
  /** Whether the disclosure is disabled. @selector [data-disabled] */
  isDisabled: boolean;
  /** State of the disclosure. */
  state: DisclosureState;
}

export interface DisclosureProps extends SlotProps, DOMRenderProps<"div", DisclosureRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "id"> {
  /** An id for the disclosure when used within a DisclosureGroup, matching the id used in `expandedKeys`. */
  id?: Key;
  /** Whether the disclosure is disabled. */
  isDisabled?: boolean;
  /** Whether the disclosure is expanded (controlled): a plain value or a two-way Signal. */
  isExpanded?: boolean | Signal<boolean>;
  /** Whether the disclosure is expanded by default (uncontrolled). */
  defaultExpanded?: boolean;
  /** Handler that is called when the disclosure's expanded state changes. */
  onExpandedChange?: (isExpanded: boolean) => void;
  /** Rivet (Angular CDK accordion item `opened`): called after the disclosure expands. */
  onOpened?: () => void;
  /** Rivet (Angular CDK accordion item `closed`): called after the disclosure collapses (also when the group collapses it). */
  onClosed?: () => void;
  /** Rivet (Angular CDK accordion item `destroyed`): called when the disclosure is removed (client-rendered). */
  onDestroyed?: () => void;
  /** The CSS class for the element. A function may be provided to compute the class based on component state. @default 'rv-Disclosure' */
  class?: ClassNameOrFunction<DisclosureRenderProps>;
  style?: StyleOrFunction<DisclosureRenderProps>;
  children?: Content | ((values: DisclosureRenderProps & { defaultChildren: Content | undefined }) => Content);
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `DisclosureContext`. */
export const DisclosureContext = resumableContext(createContext<ContextValue<DisclosureProps, HTMLDivElement>>(null, { id: "rv-disclosure" }));
/** RAC `DisclosureStateContext`. */
export const DisclosureStateContext = resumableContext(createContext<DisclosureState | null>(null, { id: "rv-disclosure-state" }));

interface InternalDisclosureContextValue {
  panelProps: DisclosureAria["panelProps"];
  panelRef: Ref<HTMLElement>;
  state: DisclosureState;
}
const InternalDisclosureContext = resumableContext(createContext<InternalDisclosureContextValue | null>(null, { id: "rv-disclosure-internal" }));

const DISCLOSURE_OWNED = ["style", "onFocusIn", "onFocusOut"] as const;

/** A disclosure is a collapsible section of content (RAC `Disclosure`). */
export function Disclosure(inProps: DisclosureProps) {
  // Live props (P5): `isDisabled` stays live (press checks, button, `data-disabled`), `isExpanded` is controlled (an
  // accessor only when defined at creation); class / style / children from a live view; the rest is read once.
  return untrack(() => disclosure(inProps));
}

/** A live disclosure's disabled state: its own (live or static) flag or the group's (a returned arrow: resumable). */
function disclosureDisabled(own: boolean | (() => boolean | undefined) | undefined, group: DisclosureGroupState | null): () => boolean {
  return () => !!read(own) || (group ? isGroupDisabled(group) : false);
}

function disclosure(inProps: DisclosureProps) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, DisclosureContext) as [DisclosureProps, RefValue<HTMLDivElement> | undefined];
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, ["isDisabled"], ["isExpanded"]) : ctxProps;
  const groupState = useContext(DisclosureGroupStateContext);
  // Generate an id if one wasn't provided.
  const domId = createId();
  const id: Key = props.id ?? domId;
  const userChange = props.onExpandedChange,
    onOpened = props.onOpened,
    onClosed = props.onClosed;
  if (groupState) {
    registerDisclosure(groupState, id, !!read(props.isDisabled));
    if (getOwner()) onCleanup(() => unregisterDisclosure(groupState, id));
  }
  const state = createDisclosureState({
    isExpanded: groupState ? () => isKeyExpanded(groupState, id) : (props.isExpanded as DisclosureProps["isExpanded"]),
    defaultExpanded: props.defaultExpanded,
    // Inline (a resume symbol): toggles the group key, then the user's callback.
    onExpandedChange: (isExpanded: boolean) => {
      if (groupState) toggleKey(groupState, id);
      userChange?.(isExpanded);
    },
  });
  // Angular CDK accordion item events: opened / closed on every change (also a group collapsing it), destroyed.
  if (onOpened || onClosed) {
    // The last reported state is a region signal (serialized): a resumed page's effect, which first runs
    // after the first change, still compares against the server-rendered state.
    const reported = _regionState(() => signal(untrack(state.isExpanded)));
    clientEffect(() => {
      const now = state.isExpanded();
      if (now === untrack(reported)) return;
      reported.set(now);
      untrack(() => (now ? onOpened?.() : onClosed?.()));
    });
  }
  const onDestroyed = props.onDestroyed;
  if (onDestroyed && getOwner()) onCleanup(() => onDestroyed());
  const panelRef = createRef<HTMLElement>();
  const ownDisabled = props.isDisabled as boolean | (() => boolean | undefined) | undefined;
  const isDisabled: boolean | (() => boolean) =
    typeof ownDisabled === "function" || groupState?.liveDisabled
      ? disclosureDisabled(ownDisabled, groupState)
      : ownDisabled || groupState?.isDisabled || false;
  // Render props keep their type (`isDisabled: boolean`): the value at creation.
  const disabledNow = !!read(isDisabled);
  const { buttonProps, panelProps } = disclosureProps({ id: domId, isDisabled, panelRef }, state);
  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const focusWithin = wantsStates ? signal(false) : undefined;
  // Options hoisted: no function in the `rp` initializer (spread sites capture `rp.class` /
  // `rp.style`, not the children accessor: per-key live views).
  const rpOptions = {
    defaultClassName: "rv-Disclosure",
    values: { isExpanded: () => state.isExpanded(), isDisabled: disabledNow, isFocusVisibleWithin: () => !!focusWithin?.(), state },
  };
  const rp = renderPropsOf<DisclosureRenderProps>(props, rpOptions);
  const dom = globalDOMProps(props, DISCLOSURE_OWNED);
  const { onFocusIn, onFocusOut } = props as { onFocusIn?: (e: FocusEvent) => void; onFocusOut?: (e: FocusEvent) => void };
  const slot = props.slot || undefined,
    r = ref as never,
    // RAC filterDOMProps forwards `id` (also the group key).
    rootId = props.id != null ? String(props.id) : undefined;
  if (props.render) {
    const attrs = {
      ...dom,
      ref: r,
      id: rootId,
      slot,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-expanded": () => dataBool(state.isExpanded()),
      "data-disabled": () => dataBool(read(isDisabled)),
      onFocusIn: (e: FocusEvent) => {
        focusWithinIn(e as never, focusWithin);
        onFocusIn?.(e);
      },
      onFocusOut: (e: FocusEvent) => {
        focusWithinOut(e as never, focusWithin);
        onFocusOut?.(e);
      },
      children: () => rp.children(),
    };
    return (
      <Provider
        values={[
          [ButtonContext, { slots: { [DEFAULT_SLOT]: {}, trigger: buttonProps } }],
          [InternalDisclosureContext, { panelProps, panelRef, state }],
          [DisclosureStateContext, state],
        ]}
      >
        {props.render(attrs as never, { isExpanded: () => state.isExpanded(), isDisabled: disabledNow, isFocusVisibleWithin: () => !!focusWithin?.(), state })}
      </Provider>
    );
  }
  return (
    <Provider
      values={[
        [ButtonContext, { slots: { [DEFAULT_SLOT]: {}, trigger: buttonProps } }],
        [InternalDisclosureContext, { panelProps, panelRef, state }],
        [DisclosureStateContext, state],
      ]}
    >
      <div
        {...dom}
        ref={r}
        id={rootId}
        slot={slot}
        class={rp.class()}
        style={rp.style()}
        data-expanded={dataBool(state.isExpanded())}
        data-disabled={dataBool(read(isDisabled))}
        onFocusIn={(e) => {
          focusWithinIn(e, focusWithin);
          onFocusIn?.(e);
        }}
        onFocusOut={(e) => {
          focusWithinOut(e, focusWithin);
          onFocusOut?.(e);
        }}
      >
        {rp.children()}
      </div>
    </Provider>
  );
}

// =================================================================================================
// DisclosurePanel
// =================================================================================================

export interface DisclosurePanelRenderProps {
  /** Whether keyboard focus is within the disclosure panel. @selector [data-focus-visible-within] */
  isFocusVisibleWithin: () => boolean;
}

export interface DisclosurePanelProps extends DOMRenderProps<"div", DisclosurePanelRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The accessibility role for the disclosure's panel. @default 'group' */
  role?: "group" | "region";
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** The CSS class for the element. @default 'rv-DisclosurePanel' */
  class?: ClassNameOrFunction<DisclosurePanelRenderProps>;
  style?: StyleOrFunction<DisclosurePanelRenderProps>;
  children?: Content | ((values: DisclosurePanelRenderProps & { defaultChildren: Content | undefined }) => Content);
  ref?: RefValue<HTMLDivElement>;
}

const PANEL_OWNED = ["style", "onFocusIn", "onFocusOut", "id", "role"] as const;

/** A DisclosurePanel provides the content for a disclosure (RAC `DisclosurePanel`). */
export function DisclosurePanel(props: DisclosurePanelProps) {
  const ctx = useContext(InternalDisclosureContext);
  if (!ctx) throw new Error("DisclosurePanel must be rendered inside a Disclosure.");
  const { panelProps, panelRef, state } = ctx;
  const role = props.role ?? "group";
  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const focusWithin = wantsStates ? signal(false) : undefined;
  // Options hoisted: no function in the `rp` initializer (spread sites capture `rp.class` /
  // `rp.style`, not the children accessor: per-key live views).
  const rpOptions = {
    defaultClassName: "rv-DisclosurePanel",
    values: { isFocusVisibleWithin: () => !!focusWithin?.() },
  };
  const rp = renderPropsOf<DisclosurePanelRenderProps>(props, rpOptions);
  const dom = globalDOMProps(props, PANEL_OWNED);
  const { onFocusIn, onFocusOut } = props as { onFocusIn?: (e: FocusEvent) => void; onFocusOut?: (e: FocusEvent) => void };
  const ref = mergeRefValues(panelRef as RefValue<HTMLElement>, props.ref as RefValue<HTMLElement> | undefined) as never;
  const id = props.id ?? panelProps.id,
    ariaLabel = props["aria-label"],
    ariaLabelledby = props["aria-labelledby"] ?? panelProps["aria-labelledby"];
  // Server: the initial size variables (the browser sets them from the hidden binding on change).
  const sizeStyle = disclosurePanelStyle(untrack(state.isExpanded));
  // Browser: keep the size variables the `hidden` binding last wrote (CSSOM). The panel element (a spread) is
  // one binding over all attributes: `hidden` is evaluated first (JSX attribute order) and writes the px sizes,
  // re-applying the server values here would clobber them (resumed panel stayed at its server size).
  // `rp.style` alone (not `rp`): the style binding must not capture the children accessor (per-key live views).
  const rpStyle = rp.style;
  const style = () => {
    const user = rpStyle();
    const panel = untrack(panelRef) as HTMLElement | null | undefined;
    return { ...(panel ? currentVars(panel, sizeStyle) : parseVars(sizeStyle)), ...user };
  };
  if (props.render) {
    const attrs = {
      ...dom,
      ref,
      id,
      role,
      class: () => rp.class(),
      // `hidden` before `style`: the hidden binding writes the size variables, `style` then keeps them.
      hidden: () => panelProps.hidden() as never,
      style,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      "aria-hidden": () => (panelProps["aria-hidden"]() ? "true" : undefined),
      onBeforeMatch: (e: Event) => disclosurePanelBeforeMatch(e as never, { id: "" }, state),
      onFocusIn: (e: FocusEvent) => {
        focusWithinIn(e as never, focusWithin);
        onFocusIn?.(e);
      },
      onFocusOut: (e: FocusEvent) => {
        focusWithinOut(e as never, focusWithin);
        onFocusOut?.(e);
      },
      children: () => rp.children(),
    };
    return props.render(attrs as never, { isFocusVisibleWithin: () => !!focusWithin?.() });
  }
  return (
    <div
      {...dom}
      ref={ref}
      id={id}
      role={role}
      class={rp.class()}
      hidden={panelProps.hidden() as never}
      style={style()}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-hidden={panelProps["aria-hidden"]() ? "true" : undefined}
      on:beforematch={(e) => disclosurePanelBeforeMatch(e, { id: "" }, state)}
      onFocusIn={(e) => {
        focusWithinIn(e, focusWithin);
        onFocusIn?.(e);
      }}
      onFocusOut={(e) => {
        focusWithinOut(e, focusWithin);
        onFocusOut?.(e);
      }}
    >
      <Provider values={[[ButtonContext, null]]}>{() => rp.children()}</Provider>
    </div>
  );
}

const currentVars = (panel: HTMLElement, css: string): Record<string, string> => {
  const out = parseVars(css);
  for (const name in out) {
    const v = panel.style.getPropertyValue(name);
    if (v) out[name] = v;
  }
  return out;
};

const parseVars = (css: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) out[decl.slice(0, i)] = decl.slice(i + 1);
  }
  return out;
};
