// Ported from react-aria-components utils (packages/react-aria-components/src/utils.tsx), Apache-2.0, © Adobe.
// THE slot / context / render-prop contract of the RAC component layer: every part (`Button`, `Heading`,
// `Text`, `Label`, `Input`, …) reads its context with `contextProps`, every container provides its
// parts' props with `<Provider values={[[ButtonContext, …], [HeadingContext, …]]}>`.
// Rivet:
// - names follow the cdk convention (no `use*`): `useContextProps` → `contextProps`, `useSlottedContext` →
//   `slottedContext`, `useRenderProps` → `renderProps`, `useSlot` → `createSlot`, RA `useSlotId` → `createSlotId`.
// - contexts are plain `createContext` tokens (`createContext(null)`, no id / registration).
// - `DEFAULT_SLOT` is a string, not a Symbol (symbol keys do not survive resume serialization).
// - refs are Rivet refs (`ref()` signal objects or callbacks; `{ current }` objects too). `contextProps`
//   returns the props' own ref when the context has none (and vice versa); when both exist it returns a
//   fresh `ref()` and copies the element to both from a `clientEffect` (a merged callback ref is not
//   resumable: a forwarded `ref={fn}` that is not a `ref()` is a resume render error).
// - render props are accessors (`isHovered()`), never snapshots: the component runs once; `class` /
//   `style` / `children` functions are called inside bindings (`class={rp.class()}`), so only
//   the binding re-runs. `renderProps` returns accessors for `class` / `style` and a `children()`
//   resolver (lazy plain JSX children / user render function / default children).
// - prop names: `class` (RAC `className`), `defaultClassName` kept as the render-prop field name (RAC).
// Deviations: no `data-rac` marker attribute; no `dom` element
// proxy (Rivet compiles element templates). `render` (`DOMRenderProps` / `DOMRenderFunction`, re-exported below from `../utils/render.ts`) is a per-part prop; `createSlot` returns
// `[Ref, hasSlot accessor]` (no layout-effect re-render; see `createSlot`).
import { createContext, onCleanup, signal, untrack, useContext, type Context, type Signal } from "@rivetjs/reactivity";
import { resumedId } from "../utils/id.ts";
import { Provider as ContextProvider, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, JSX, Ref } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { mergeCopy, mergeProps } from "../interactions/merge-props.tsx";
import { splitProps } from "@rivetjs/runtime/props";
import { hasLive } from "../utils/live.tsx";
import type { StyleObject } from "../utils/types.ts";

export { createContext, useContext, type Context };
export type { DOMRenderProps, DOMRenderFunction } from "../utils/render.ts";
export type { StyleObject };

/** Key of the default (unnamed) slot in a `{ slots }` context value. */
export const DEFAULT_SLOT = "__rv_default_slot";

/** A Rivet ref value: a `ref()` signal object, a callback receiving the element, or a `{ current }` object. */
export type RefValue<E extends Element = Element> = Ref<E> | ((element: E) => void) | { current: E | null };

interface SlottedValue<T> {
  slots?: Record<string, T>;
}

export type SlottedContextValue<T> = SlottedValue<T> | T | null | undefined;
export type WithRef<T, E extends Element = Element> = T & { ref?: RefValue<E> };
/** Value of a part context: the part's props (+ `ref`), optionally keyed by slot name (`{ slots: { close: {…} } }`). */
/** Context `id` may also be a `SlotId` (`createSlotId`): the part takes its id and reports itself rendered. */
export type ContextValue<T, E extends Element = Element> = SlottedContextValue<
  WithRef<T extends { id?: unknown } ? Omit<T, "id"> & { id?: T["id"] | SlotId } : T, E>
>;

/**
 * Props whose values may also be accessors (ACCESSOR RULE: state-dependent values such as `aria-invalid`,
 * `disabled` travel as accessors and are read in bindings / resolved by the element spread). Event handlers
 * (`on*`) and the keys in `Except` (read once by the part) stay plain.
 */
export type AccessorProps<T, Except extends keyof T = never> = {
  [P in keyof T]: P extends Except ? T[P] : P extends `on${string}` ? T[P] : T[P] | (() => T[P]);
};

/** One `[context, value]` pair of `<Provider values>`. */
export type ProviderValue<T> = [Context<T>, T];

export interface ProviderProps {
  /** `[context, value]` pairs, outermost first. */
  values: ProviderValue<any>[];
  children?: Content;
}

/** Provides several contexts at once (RAC `Provider`); later pairs are nested inside earlier ones. */
export function Provider(props: ProviderProps) {
  const values = props.values;
  const content = props.children;
  return <Nest values={values} index={0} content={content} />;
}

function Nest(props: { values: ProviderValue<any>[]; index: number; content: Content }) {
  const { values, index, content } = props;
  if (index >= values.length) return renderSlot(content);
  const token = values[index]![0];
  const value = values[index]![1];
  return (
    <ContextProvider token={token} value={value}>
      <Nest values={values} index={index + 1} content={content} />
    </ContextProvider>
  );
}

export interface StyleProps {
  /** The CSS class of the element. */
  class?: string;
  /** The inline style of the element. */
  style?: StyleObject;
}

export interface DOMProps extends StyleProps {
  /** The element's unique identifier. */
  id?: string;
  /** The children of the component. */
  children?: Content;
}

/** `class` prop of a component with render props: a string, or a function of the render props (called in a binding). */
export type ClassNameOrFunction<T> = string | ((values: T & { defaultClassName: string | undefined }) => string | undefined);
/** `style` prop of a component with render props: an object, or a function of the render props (called in a binding). */
export type StyleOrFunction<T> = StyleObject | ((values: T & { defaultStyle: StyleObject }) => StyleObject | undefined);

export interface StyleRenderProps<T> {
  /**
   * The CSS class of the element. A function may be provided to compute the class based on component state
   * (render props are accessors: `class={({ isSelected }) => (isSelected() ? "on" : "off")}`).
   */
  class?: ClassNameOrFunction<T> | undefined;
  /** The inline style of the element. A function may be provided to compute the style based on component state. */
  style?: StyleOrFunction<T> | undefined;
}

/** `children` of a component with render props: content, or a function of the render props. */
export type ChildrenOrFunction<T> = Content | ((values: T & { defaultChildren: Content | undefined }) => Content);

export interface RenderProps<T> extends StyleRenderProps<T> {
  /** The children of the component. A function may be provided to alter the children based on component state. */
  children?: ChildrenOrFunction<T> | undefined;
}

export interface RenderPropsHookOptions<T> extends RenderProps<T> {
  /** The render props (accessors). */
  values: T;
  defaultChildren?: Content;
  defaultClassName?: string;
  defaultStyle?: StyleObject;
}

/** Live views of a part's props for `renderProps`, one key each: `class`, `style`, `children` (`renderPropsOf`). */
export type LiveRenderProps<T> = readonly [Pick<RenderProps<T>, "class">, Pick<RenderProps<T>, "style">, Pick<RenderProps<T>, "children">];

export interface RenderPropsHookRetVal {
  /** The resolved class (read it inside a binding: `class={rp.class()}`). */
  class: () => string | undefined;
  /** The resolved style (read it inside a binding: `style={rp.style()}`). */
  style: () => StyleObject | undefined;
  /** The resolved children (render where the content goes: `{rp.children()}`). */
  children: () => Content;
}

/**
 * Resolves `class` / `style` / `children` render props (RAC `useRenderProps`). The returned accessors call
 * the user's functions with `{ ...values, defaultClassName | defaultStyle | defaultChildren }`.
 */
export function renderProps<T>(props: RenderPropsHookOptions<T>, from?: RenderProps<T> | LiveRenderProps<T>): RenderPropsHookRetVal {
  const { defaultClassName, defaultChildren, defaultStyle, values } = props;
  // Live props (P5): `from` (a `liveView` of the part's props, or one view per key: `renderPropsOf`) supplies `class` /
  // `style` / `children`, read inside the accessors (getters stay live); without it the options' values are used as
  // given. One view per key: each accessor captures only its own key on a resumed page — a `children` function capturing
  // a class instance (a calendar cell's `date`) does not make the `class` binding unserializable (RESUME-BUGS 2026-10-09,
  // ui-docs calendar indicators).
  if (from) {
    const [classView, styleView, childrenView]: LiveRenderProps<T> = Array.isArray(from)
      ? (from as LiveRenderProps<T>)
      : [from as RenderProps<T>, from as RenderProps<T>, from as RenderProps<T>];
    return {
      class: () => {
        const className = classView.class;
        return (typeof className === "function" ? className({ ...values, defaultClassName }) : className) ?? defaultClassName;
      },
      style: () => {
        const style = styleView.style;
        const computed = typeof style === "function" ? style({ ...values, defaultStyle: defaultStyle || {} }) : style;
        return computed || defaultStyle ? { ...defaultStyle, ...computed } : undefined;
      },
      children: () => resolveChildren(childrenView.children, values, defaultChildren),
    };
  }
  // Static options: each accessor is made for its key's value (`classOf` / `styleOf` / `childrenOf`), so only a render
  // function captures `values` — a string class / style or plain children resume without the render-props bag (the
  // collection / selection state) — DIET-STATE 2, 2026-10-22.
  const { class: className, style, children } = props;
  return {
    class: classOf(className, values, defaultClassName),
    style: styleOf(style, values, defaultStyle),
    children: childrenOf(children, values, defaultChildren),
  };
}

// One accessor per shape, each an object-literal function value (a resumable symbol capturing only what it reads).
function classOf<T>(className: RenderProps<T>["class"], values: T, defaultClassName: string | undefined): () => string | undefined {
  if (typeof className === "function") {
    const accessor = { fn: () => className({ ...values, defaultClassName }) ?? defaultClassName };
    return accessor.fn;
  }
  const accessor = { fn: () => className ?? defaultClassName };
  return accessor.fn;
}

function styleOf<T>(style: RenderProps<T>["style"], values: T, defaultStyle: StyleObject | undefined): () => StyleObject | undefined {
  if (typeof style === "function") {
    const accessor = {
      fn: () => {
        const computed = style({ ...values, defaultStyle: defaultStyle || {} });
        return computed || defaultStyle ? { ...defaultStyle, ...computed } : undefined;
      },
    };
    return accessor.fn;
  }
  const accessor = { fn: () => (style || defaultStyle ? { ...defaultStyle, ...style } : undefined) };
  return accessor.fn;
}

function childrenOf<T>(children: RenderProps<T>["children"], values: T, defaultChildren: Content | undefined): () => Content {
  if (typeof children === "function" && !isSlot(children)) {
    const accessor = { fn: () => (children as (v: unknown) => Content)({ ...values, defaultChildren }) ?? renderSlot(defaultChildren) };
    return accessor.fn;
  }
  const accessor = {
    fn: () =>
      (children == null ? renderSlot(defaultChildren) : isSlot(children) ? (renderSlot(children) as Content) : (children as Content)) ??
      renderSlot(defaultChildren),
  };
  return accessor.fn;
}

/**
 * `renderProps` for a part's own props (`renderProps({ ...props, values, defaultClassName })`): live props (an own
 * getter) → `class` / `style` / `children` read through one live view per key inside the accessors (`liveRenderProps`);
 * static → the values. `keys`: the keys taken from the props (default all three; TabList leaves its collection
 * children out). Call it directly in the `const rp = …` initializer, no `untrack(() => …)` wrapper and no inline arrow
 * in `options` (hoist `values`): a function in the initializer makes the compiler capture `rp` whole in spread sites,
 * so the class / style binding would encode the children accessor too (per-key views wasted).
 */
export function renderPropsOf<T>(
  props: RenderProps<T>,
  options: Omit<RenderPropsHookOptions<T>, "class" | "style" | "children">,
  keys?: readonly RenderKey[],
): RenderPropsHookRetVal {
  if (hasLive(props)) return renderProps(options as RenderPropsHookOptions<T>, liveRenderProps<T>(props, keys));
  if (!keys) return renderProps({ class: props.class, style: props.style, children: props.children, ...options } as RenderPropsHookOptions<T>);
  return renderProps({
    class: keys.includes("class") ? props.class : undefined,
    style: keys.includes("style") ? props.style : undefined,
    children: keys.includes("children") ? props.children : undefined,
    ...options,
  } as RenderPropsHookOptions<T>);
}

type RenderKey = "class" | "style" | "children";
const NO_VIEW = {};

/**
 * The live `from` of `renderProps` for live props (`hasLive(props)`): one forwarding `splitProps` view per key
 * (`[class, style, children]`), so each resolved accessor captures only its own key on a resumed page. A shared
 * `liveView(props, ["class", "style", "children"])` made the `class` / `style` bindings capture the children too: a
 * children function capturing a class instance (a calendar cell's `date`) failed the resumable render. `keys` = the
 * keys taken from the props (default all three); a left-out key gets an empty view (`renderProps` falls back to its
 * default, as a `liveView` without that key did).
 */
export function liveRenderProps<T>(props: object, keys?: readonly RenderKey[]): LiveRenderProps<T> {
  const views = splitProps(props as Record<string, any>, ["class"], ["style"], ["children"]);
  if (!keys) return [views[0], views[1], views[2]] as unknown as LiveRenderProps<T>;
  return [
    keys.includes("class") ? views[0] : NO_VIEW,
    keys.includes("style") ? views[1] : NO_VIEW,
    keys.includes("children") ? views[2] : NO_VIEW,
  ] as unknown as LiveRenderProps<T>;
}

function resolveChildren(children: unknown, values: unknown, defaultChildren: Content | undefined): Content {
  let computed: Content | undefined;
  if (isSlot(children)) computed = renderSlot(children) as Content;
  else if (typeof children === "function") computed = (children as (v: unknown) => Content)({ ...(values as object), defaultChildren });
  else if (children == null) computed = renderSlot(defaultChildren);
  else computed = children as Content;
  return computed ?? renderSlot(defaultChildren);
}

/**
 * Combines a user-provided render prop value (a static value or a function) with another value
 * (RAC `composeRenderProps`).
 */
export function composeRenderProps<T, U, V extends T>(
  value: T extends any ? T | ((renderProps: U) => V) : never,
  wrap: (prevValue: T, renderProps: U) => V,
): (renderProps: U) => V {
  // Object-literal function value: a resumable symbol (bindings on resumed pages may capture it).
  const composed = {
    fn: (renderProps: U): V => wrap(typeof value === "function" && !isSlot(value) ? (value as (renderProps: U) => V)(renderProps) : (value as T), renderProps),
  };
  return composed.fn;
}

export interface SlotProps {
  /**
   * A slot name for the component. Slots allow the component to receive props from a parent component.
   * An explicit `null` value indicates that the local props completely override all props received from a parent.
   * Read once at mount (it picks the context props).
   */
  slot?: string | null;
}

/** The context value for `slot` (RAC `useSlottedContext`); throws for an unknown slot of a slotted value. */
export function slottedContext<T>(context: Context<SlottedContextValue<T>>, slot?: string | null): T | null | undefined {
  const ctx = useContext(context);
  if (slot === null) {
    // An explicit `null` slot means don't use context.
    return null;
  }
  if (ctx && typeof ctx === "object" && "slots" in ctx && ctx.slots) {
    const slotKey = slot || DEFAULT_SLOT;
    if (!ctx.slots[slotKey]) {
      const availableSlots = new Intl.ListFormat().format(Object.keys(ctx.slots).map((p) => `"${p}"`));
      const errorMessage = slot ? `Invalid slot "${slot}".` : "A slot prop is required.";
      throw new Error(`${errorMessage} Valid slot names are ${availableSlots}.`);
    }
    return ctx.slots[slotKey];
  }
  return ctx as T | null | undefined;
}

function assignRef<E extends Element>(target: RefValue<E> | undefined, element: E | null): void {
  if (target == null) return;
  if (typeof target === "function") {
    const signalRef = target as unknown as { set?: (value: E | undefined) => void };
    if (signalRef.set) signalRef.set(element ?? undefined);
    else (target as (element: E | null) => void)(element);
  } else target.current = element;
}

/**
 * Merges the props a parent provided through `context` (for `props.slot`) with the component's own
 * props (RAC `useContextProps`): own props win, handlers chain, classes join, `style` objects merge
 * (functions compose). Returns the merged props (without `ref`) and the ref to put on the element.
 */
export function contextProps<T extends object, U extends SlotProps, E extends Element>(
  props: T & SlotProps,
  ref: RefValue<E> | undefined,
  context: Context<ContextValue<U, E>>,
): [T, RefValue<E> | undefined] {
  const ctx = (slottedContext(context, props.slot) || {}) as Record<string, any>;
  // Live props (P5): own / context getters stay getters (see `liveContextProps`); the copy path below is unchanged.
  if (hasLive(props) || hasLive(ctx)) return liveContextProps(props, ref, ctx);
  // `ctxProps` is our copy (merged into in place below); `ownProps` is only read: no copy unless it holds a `ref`.
  const { ref: contextRef, ...ctxProps } = ctx;
  const ownProps: Record<string, any> = Object.hasOwn(props, "ref") ? withoutRef(props) : props;
  // A slot id (`createSlotId`): this part renders, so the owner's aria-labelledby / -describedby keep it.
  if (isSlotId(ctxProps.id)) {
    const slotId = ctxProps.id;
    ctxProps.id = slotId.id;
    const own = (ownProps as { id?: unknown }).id;
    if (own === undefined || own === slotId.id) markRendered(slotId);
    // The part keeps its own id (RA mergeIds): the owner's aria-labelledby / -describedby follow it.
    else if (typeof own === "string" && own !== "") markRendered(slotId, own);
  } else if (isMergedId(ctxProps.id)) {
    // RA mergeIds: the parent's `useId` holder switches to the part's own id (which wins in mergeProps).
    const mergedId = ctxProps.id;
    const own = (ownProps as { id?: unknown }).id;
    ctxProps.id = mergedId.id;
    if (typeof own === "string" && own !== "") setRendered(mergedId.current, own);
  }
  const contextStyle = ctxProps.style;
  // Neither side holds a getter (checked above): the copy path without a second scan; the context copy is the result
  // (merged in place: `ctxProps` is not read after this).
  const mergedProps = mergeCopy([ctxProps, ownProps], true);

  // mergeProps does not merge `style`.
  if (contextStyle && "style" in ownProps && ownProps.style) {
    const propsStyle = ownProps.style;
    if (typeof contextStyle === "function" || typeof propsStyle === "function") {
      // Object-literal function value: R2 makes it a resumable symbol (an assigned arrow is not), so a
      // part's resumed style binding may capture it.
      const composed = {
        style: (renderProps: { defaultStyle?: StyleObject }) => {
          const fromContext = typeof contextStyle === "function" ? contextStyle(renderProps) : contextStyle;
          const defaultStyle = { ...renderProps.defaultStyle, ...fromContext };
          const own = typeof propsStyle === "function" ? propsStyle({ ...renderProps, defaultStyle }) : propsStyle;
          return { ...defaultStyle, ...own };
        },
      };
      mergedProps.style = composed.style;
    } else {
      mergedProps.style = { ...contextStyle, ...propsStyle };
    }
  }

  return [mergedProps as T, mergeRefValues<E>(ref, contextRef as RefValue<E> | undefined)];
}

function withoutRef(object: object): Record<string, any> {
  const { ref: _ref, ...rest } = object as Record<string, any>;
  return rest;
}

/**
 * `contextProps` over live props (own or context getters): nothing is read while merging. The merged object is the
 * cdk `mergeProps` live merge of the context props and the own props (both without `ref`, `splitProps` parts that
 * forward unread): own defined values win per read, handlers chain at call time, classes join in an accessor. `id`
 * (slot / merged ids) and `ref` are read once (identity props); a live `style` on either side composes at read time.
 */
function liveContextProps<T extends object, E extends Element>(
  props: T & SlotProps,
  ref: RefValue<E> | undefined,
  ctx: Record<string, any>,
): [T, RefValue<E> | undefined] {
  const contextRef = ctx.ref as RefValue<E> | undefined;
  const ctxId = Object.getOwnPropertyDescriptor(ctx, "id")?.get === undefined ? ctx.id : undefined;
  // A slot / merged id holder is replaced by its plain id (below), never merged as an object.
  const ctxProps = splitProps(ctx, isSlotId(ctxId) || isMergedId(ctxId) ? ["ref", "id"] : ["ref"])[1] as Record<string, any>;
  const ownProps = splitProps(props as Record<string, any>, ["ref"])[1] as Record<string, any>;
  let idOverride: Record<string, unknown> | undefined;
  if (isSlotId(ctxId)) {
    const own = (props as { id?: unknown }).id;
    idOverride = { id: ctxId.id };
    if (own === undefined || own === ctxId.id) markRendered(ctxId);
    else if (typeof own === "string" && own !== "") markRendered(ctxId, own);
  } else if (isMergedId(ctxId)) {
    const own = (props as { id?: unknown }).id;
    idOverride = { id: ctxId.id };
    if (typeof own === "string" && own !== "") setRendered(ctxId.current, own);
  }
  const sources: Record<string, any>[] = [ctxProps];
  if (idOverride) sources.push(idOverride);
  sources.push(ownProps);
  // mergeProps does not merge `style`: both sides set → composed at read time (a function style resolves render props).
  if (Object.hasOwn(ctxProps, "style") && Object.hasOwn(ownProps, "style")) {
    // One-key views: the composed style (a part's resumed style binding captures it) must not reach the other props
    // (children capturing a class instance).
    const ctxStyle = splitProps(ctxProps, ["style"])[0] as Record<string, any>;
    const ownStyle = splitProps(ownProps, ["style"])[0] as Record<string, any>;
    const composed = {
      style: (renderProps: { defaultStyle?: StyleObject }) => {
        const contextStyle = ctxStyle.style;
        const propsStyle = ownStyle.style;
        const fromContext = typeof contextStyle === "function" ? contextStyle(renderProps) : contextStyle;
        const defaultStyle = { ...renderProps?.defaultStyle, ...fromContext };
        const own = typeof propsStyle === "function" ? propsStyle({ ...renderProps, defaultStyle }) : propsStyle;
        return { ...defaultStyle, ...own };
      },
    };
    sources.push({ style: composed.style });
  }
  return [mergeProps(...sources) as T, mergeRefValues<E>(ref, contextRef)];
}

/**
 * One ref for an element from two refs (RA `mergeRefs` / `useSyncRef` for Rivet refs): either alone is
 * returned as is; both → a fresh `ref()` whose element a `clientEffect` copies to both (see the header).
 */
export function mergeRefValues<E extends Element>(own: RefValue<E> | undefined, fromContext: RefValue<E> | undefined): RefValue<E> | undefined {
  if (own == null) return fromContext;
  if (fromContext == null || fromContext === own) return own;
  const element = createRef<E>();
  clientEffect(() => {
    const el = element() ?? null;
    untrack(() => {
      assignRef(own, el);
      assignRef(fromContext, el);
    });
  });
  return element;
}

/**
 * Whether a slotted element (e.g. a `<Heading slot="title">` inside a Dialog) rendered (RAC `useSlot`).
 * Put the returned ref on the slot element's context value; `hasSlot()` is `initialState` until that
 * element exists in the browser (server render: `initialState`; resumed page: whether the server
 * rendered it), then whether it is attached.
 */
export function createSlot(initialState: boolean | (() => boolean) = true): [Ref<Element>, () => boolean] {
  const element = createRef<Element>();
  const initial = typeof initialState === "function" ? initialState() : initialState;
  // An object-literal function value (R2 rewrites those into resumable symbols; array elements and plain
  // local consts are not), so a binding on a resumed page may capture `hasSlot`.
  // RAC useSlot: the ref being set = rendered (set on mount, reset on unmount by the runtime). Server: `initialState`,
  // or true once the slot part rendered earlier in this render (`markSlotRendered`: RAC's ref callback turns a `false`
  // initial state true, e.g. a TagGroup with `aria-label` and a visible Label; the resumed page keeps the server value).
  const slot = { hasSlot: () => element() !== undefined || (typeof document === "undefined" && (initial || (element as SlotRef)[SLOT_RENDERED] === true)) };
  return [element, slot.hasSlot];
}

const SLOT_RENDERED = Symbol.for("rv.slotRendered");
type SlotRef = { [SLOT_RENDERED]?: true };

/**
 * @internal Server: the part holding a `createSlot` ref rendered (Label calls it with its context ref), so an owner whose
 * attributes render after it sees `hasSlot()` true even with a `false` initial state. Browser: unused (the ref is set).
 */
export function markSlotRendered(ref: unknown): void {
  if (typeof ref === "function") (ref as SlotRef)[SLOT_RENDERED] = true;
}

/**
 * An id for a slotted part that may not render (RA `useSlotId`). Client render: `rendered()` starts `true` (RA's
 * first render keeps the id), then a `clientEffect` after mount checks `document.getElementById(id)` and drops the
 * id when no element has it; the check re-runs when the signals read by `deps` change (RA `depArray`). Fast path
 * (same semantics): a part consuming the id through `contextProps` sets `rendered` true while mounted and false when
 * it unmounts.
 * Server render (UI-COLD 2026-10-08): no check effect, so a resumed page does not boot the runtime for it.
 * `rendered()` starts `false` and the consuming part marks it (no server cleanup), so the serialized flag says
 * whether the part is in the HTML; only a server-rendered part of an id with `deps` (it may unmount later) records
 * its unmount cleanup as a client effect. `slotIdRef` keeps an id whose part may still render later in the tree
 * (RA's server HTML) and reads the flag, so the owner's binding resumes and follows the part.
 * Deviation from RA (which drops an id without element after mount): a server id whose part never rendered (no
 * `deps`) stays in the owner's attribute until that binding re-runs for another reason (a validity change, the part
 * mounting); assistive technology ignores IDREFs without an element. A check effect at the first interaction was
 * tried and dropped: it loaded the owners' chunks mid-interaction (lost DateField keys).
 * Plain data + a signal, so it serializes in context values.
 * Usage: provide `{ id: slotId }` in the part's context and read `slotIdRef(slotId)` inside the owner's
 * `aria-labelledby` / `-describedby` binding.
 */
export interface SlotId {
  /** The element id the part gets. */
  readonly id: string;
  /**
   * Whether the id is in use (an element with it exists, or it has not been checked yet); a string when the part
   * rendered with its own `id` prop (RA mergeIds): the id the owner must reference instead of `id`.
   */
  readonly rendered: Signal<boolean | string>;
}

/**
 * Creates a slot id (RA `useSlotId(depArray)`); `id` defaults to a generated one; the signals `deps` reads re-run
 * the check. `deps` is captured by a resumable effect: pass a signal / computed or a local const function, not an
 * inline arrow argument (arguments are not resumable).
 */
export function createSlotId(id?: string, deps?: () => unknown): SlotId {
  const slotId: SlotId = { id: id ?? resumedId(), rendered: signal<boolean | string>(!SERVER) };
  if (!SERVER)
    clientEffect(() => {
      if (deps) deps();
      // After the DOM updates of this change (RA: layout effect after commit).
      queueMicrotask(() => syncRendered(slotId, document));
    });
  else if (deps) changing.add(slotId);
  return slotId;
}

/** Server render: slot ids created with `deps` (their part may unmount on the resumed page). */
const changing = new WeakSet<SlotId>();

/**
 * The flag follows the DOM. A server id whose part never rendered is `false` already (serialized) while the owner's
 * attribute still holds it: remove the token from the attributes that reference it (no signal change to re-run the
 * binding).
 */
function syncRendered(slotId: SlotId, doc: Document): void {
  const flag = untrack(slotId.rendered);
  const id = typeof flag === "string" ? flag : slotId.id;
  const present = doc.getElementById(id) !== null;
  if (present || flag) {
    if (!(present && typeof flag === "string")) slotId.rendered.set(present);
    return;
  }
  for (const el of doc.querySelectorAll("[aria-describedby], [aria-labelledby]"))
    for (const name of ["aria-describedby", "aria-labelledby"]) {
      const tokens = el.getAttribute(name)?.split(/\s+/);
      if (!tokens?.includes(id)) continue;
      const rest = tokens.filter((token) => token && token !== id);
      if (rest.length) el.setAttribute(name, rest.join(" "));
      else el.removeAttribute(name);
    }
}

const SERVER = typeof document === "undefined";

/**
 * The slot id's id while it is in use, else `undefined` (read it inside a binding). `expected`: server only, whether
 * the part may still render later in the tree (an owner reads before its later parts): the id is kept then (RA's
 * server HTML); a FieldError's id passes the validity (RAC FieldError renders only while invalid).
 */
export function slotIdRef(slotId: SlotId | undefined, expected = true): string | undefined {
  if (!slotId) return undefined;
  // Server: read the flag (the owner's binding resumes and follows the part).
  const flag = slotId.rendered();
  if (typeof flag === "string") return flag;
  return flag || (SERVER && expected) ? slotId.id : undefined;
}

/**
 * Server slot probe (`probeSlots`): a hideable part that renders nothing in the probe marks the slot id its context
 * gives it (the id it would consume through `contextProps`), so the owner can write `slotIdRef(id, false)`.
 */
export function probeSlot(props: { slot?: string | null; id?: unknown }, context: Context<ContextValue<any, any>>): void {
  const id = (slottedContext(context, props.slot) as { id?: unknown } | null | undefined)?.id;
  if (!isSlotId(id)) return;
  if (props.id === undefined || props.id === id.id) setRendered(id.rendered, true);
  else if (typeof props.id === "string" && props.id !== "") setRendered(id.rendered, props.id);
}

/** Whether `value` is a `SlotId`. */
export function isSlotId(value: unknown): value is SlotId {
  return value !== null && typeof value === "object" && typeof (value as SlotId).id === "string" && typeof (value as SlotId).rendered === "function";
}

/**
 * A parent's generated id that a part may replace with its own (RA `useId` + `mergeIds`): an Autocomplete's
 * collection id / a ComboBox's listbox id passed in a context value (`{ id: mergedId }`). When the consuming part
 * (`contextProps`) has its own `id`, `current` switches to it (RA re-renders the `useId` holder with the merged id),
 * so the parent's `aria-controls` / `aria-activedescendant` bindings follow. Runs during the part's render: on the
 * server that precedes the parent's attribute writes (spread accessors are written after the synchronous tree is
 * built), so SSR markup already points at the part's id. Plain data + a signal: serializes in context values.
 */
export interface MergedId {
  /** The parent's generated id (the part's id when it has none). */
  readonly id: string;
  /** The id in use: `id`, or the consuming part's own id. */
  readonly current: Signal<string>;
}

/** Creates a merged id (`id` defaults to a generated one). Read `mergedId.current()` inside bindings. */
export function createMergedId(id?: string): MergedId {
  const value = id ?? resumedId();
  return { id: value, current: signal(value) };
}

/** Whether `value` is a `MergedId`. */
export function isMergedId(value: unknown): value is MergedId {
  return value !== null && typeof value === "object" && typeof (value as MergedId).id === "string" && typeof (value as MergedId).current === "function";
}

/** The plain id of an id prop that may be a `MergedId` (its generated `id`). */
export function mergedIdOf(id: unknown): string | undefined {
  return isMergedId(id) ? id.id : (id as string | undefined);
}

function markRendered(slotId: SlotId, value: true | string = true): void {
  setRendered(slotId.rendered, value);
  // Server: the flag stays set (the part is in the HTML). A part whose id has `deps` may unmount on the resumed page:
  // its region gets the client cleanup the server cannot hand over (a client effect, so that page boots at idle).
  if (!SERVER) onCleanup(() => setRendered(slotId.rendered, false));
  else if (changing.has(slotId)) clientEffect(() => () => setRendered(slotId.rendered, false));
}

/** Writes the flag; skips no-op writes, and defers one made during a computed evaluation (a build pass). */
function setRendered<T>(flag: Signal<T>, value: T): void {
  if (untrack(flag) === value) return;
  try {
    flag.set(value);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("during computed evaluation")) throw error;
    queueMicrotask(() => flag.set(value));
  }
}

/** Filters out `data-*` attributes to keep them from being passed down and duplicated (RAC `removeDataAttributes`). */
export function removeDataAttributes<T extends object>(props: T): T {
  const prefix = /^(data-.*)$/;
  const filteredProps = {} as T;
  for (const prop in props) if (!prefix.test(prop)) filteredProps[prop] = props[prop];
  return filteredProps;
}

/** Override of the shared `Validation` base that changes the default (RAC `RACValidation`). */
export interface RACValidation {
  /**
   * Whether to use native HTML form validation to prevent form submission when the value is missing or
   * invalid, or mark the field as required or invalid via ARIA.
   *
   * @default 'native'
   */
  validationBehavior?: "native" | "aria";
}

/**
 * Native attributes of element `K` as component props (RAC `HTMLAttributes<…>`), without the props the
 * part handles itself (`children`, `ref`, `slot`, `class`, `style`).
 */
export type HTMLProps<K extends keyof JSX.IntrinsicElements> = Omit<JSX.IntrinsicElements[K], "children" | "ref" | "slot" | "class" | "className" | "style">;
