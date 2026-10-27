// The Motion element (spec D9 / D10): `motionElement(props, tag)` turns a tag component's props into what its compiled
// `<tag>` binds (`tags/<tag>.tsx`). One compiled element per tag, not `Dynamic`: props passed to `Dynamic` are no resume
// sites, so a resumed page would bind nothing (T8). The element gets:
// - the FINAL state (`animate` over `initial`) inline, merged after the user's `style`: visible and LCP-valid without
//   CSS or JS (spec D9);
// - an entrance (`initial` → `animate` at mount) lowered to CSS: server render pushes one rule per distinct entrance
//   into the head sink (`@rivetjs/router` component head, request nonce; `data-mve="<hash>"`), a client render adds it
//   to one constructable stylesheet, a server render without a head sink uses inline `--rv-mve-*` custom properties
//   for the static `@rivetjs/motion/entrance.css` (`data-mvv`);
// - live `animate` changes from a binding (`data-mv-t`, never written): zero JS until the target changes; then
//   `motion/mini` (WAAPI) animates from the element's current values (engine.ts);
// - gesture handlers per group present at creation, `whileInView` through a `visible` clientEffect.
// Every function handed to the tag is a local arrow returned in an object literal: the compiler registers it (`_rFn`),
// so the tag's bindings and handlers resume with their captures.
import { createContext, onCleanup, signal, untrack, useContext } from "@rivetjs/reactivity";
import { clientEffect, Provider, ref as elementRef, type Ref } from "@rivetjs/runtime/dom";
import { overlayPresence, TransitionScopeProvider, useTransitionScope, type OverlayPresence, type TransitionScope } from "@rivetjs/kit/transition";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { _restProps, _spreadProps } from "@rivetjs/runtime/props";
import { DEV } from "#dev";
import { headSink, serverEntrance } from "#server";
import type { ReducedPolicy, Stagger } from "./css.ts";
import type { Entrance } from "./entrance.ts";
import { motionState } from "./engine.ts";
import { loadInView } from "./observe-load.ts";
import { layoutHook } from "./layout-hook.ts";
import { animateLayers, gesture, setExit, setLayer, type LayerProps } from "./gestures.ts";
import { finalState, hybridReason, toStyle, type MotionState, type Target, type Transition } from "./values.ts";
import { labelsOf, mergeTransition, resolveTarget, type Definition, type Variants } from "./variants.ts";

/** Motion props of `<Motion.*>` / `<MotionElement>` (Motion React names; `whilePress` = Motion's `whileTap`). */
export interface MotionProps {
  /**
   * Layout animation (Motion's `layout`): the element animates from its old box when an `animateLayout(update)` from
   * `@rivetjs/motion/layout` changes its layout. `"position"` / `"size"` limit it to one. Read once.
   */
  layout?: boolean | "position" | "size";
  /** Shared-element id: a new element with the id starts at the box of the one it replaces (`@rivetjs/motion/layout`). Read once. */
  layoutId?: string;
  /** Start state for the entrance (lowered to CSS), a variant label, or `false` (render `animate` directly). */
  initial?: Definition | false;
  /** Target: values, keyframe arrays, a variant label (live: changes animate with `motion/mini`). */
  animate?: Definition;
  transition?: Transition;
  variants?: Variants;
  /** Passed to function variants. */
  custom?: unknown;
  /** `false`: do not follow the parent's variant labels (default: a child without its own `animate` follows them). */
  inherit?: boolean;
  /** Reduced motion for this element (default: `MotionConfig`'s, else `"user"`): `"user"`, `"always"`, `"never"`. */
  reducedMotion?: ReducedPolicy;
  onAnimationStart?(definition: Definition): void;
  onAnimationComplete?(definition: Definition): void;
  /** While a mouse / pen hovers (touch ignored). */
  whileHover?: Definition;
  /** While pressed: primary pointer down until release, or Enter / Space held on the (focusable) element. */
  whilePress?: Definition;
  /** While the element itself is focused and shows focus (`:focus-visible`). */
  whileFocus?: Definition;
  /** While the element is in the viewport (`viewport`: root / margin / amount / once). */
  whileInView?: Definition;
  viewport?: Viewport;
  /** Target while the enclosing presence scope leaves (`Presence`, `PresenceFor`, any kit `Transition` / cdk overlay
   * on it): the scope keeps the element mounted until it finished; reopening during the exit animates back. */
  exit?: Definition;
  onHoverStart?(event: PointerEvent): void;
  onHoverEnd?(event: PointerEvent): void;
  onPressStart?(event: PointerEvent | KeyboardEvent): void;
  /** `success`: released over the element (pointer) or by releasing the key; false on cancel / release outside / blur. */
  onPressEnd?(event: PointerEvent | KeyboardEvent | FocusEvent, info: { success: boolean }): void;
  /** A successful press. */
  onPress?(event: PointerEvent | KeyboardEvent): void;
}

/** `whileInView` options (Motion's `viewport`). */
export interface Viewport {
  /** Stay in the in-view state after the first entry. */
  once?: boolean;
  /** Scroll container (default: the window viewport); a `ref()` resolves when the effect runs. */
  root?: Element | (() => Element | null | undefined);
  /** `rootMargin` (`"0px 0px -100px 0px"`). */
  margin?: string;
  /** Visible fraction that counts as in view: `"some"` (default), `"all"` or 0–1. */
  amount?: "some" | "all" | number;
  /** `"initial"` (default): the server renders `initial` (hidden until in view). `"final"`: the in-view target (visible
   * without JS; nothing animates on view). */
  ssr?: "initial" | "final";
}

type Intrinsic = JSX.IntrinsicElements;
/** Props of `<Motion.<tag>>`: the tag's intrinsic props + `MotionProps`. */
export type MotionTagProps<T extends keyof Intrinsic> = Intrinsic[T] & MotionProps;

const OWN = [
  "initial",
  "animate",
  "transition",
  "variants",
  "custom",
  "inherit",
  "children",
  "reducedMotion",
  "onAnimationStart",
  "onAnimationComplete",
  "style",
  "ref",
  "whileHover",
  "whilePress",
  "whileFocus",
  "whileInView",
  "viewport",
  "exit",
  "layout",
  "layoutId",
  "onHoverStart",
  "onHoverEnd",
  "onPressStart",
  "onPressEnd",
  "onPress",
  // Composed with the gesture handlers (the user's run first).
  "onPointerEnter",
  "onPointerLeave",
  "onPointerDown",
  "onPointerUp",
  "onKeyDown",
  "onKeyUp",
  "onFocusIn",
  "onFocusOut",
] as const;

/**
 * An overlay's presence scope (kit `overlayPresence`, cdk Modal): Motion elements with `exit` in its content play it on
 * close and hold the unmount. `rendered: false` + `appear: false`: content is created on open (entrances play), nested
 * kit `<Transition>`s keep their own `appear` default; `leaving` is not read. The holds are taken a microtask after the
 * overlay's own exit ended (its exit may end at once: no CSS animation), only when an element with `exit` registered.
 */
function overlayScope(isOpen: () => boolean): OverlayPresence {
  const held = { list: [] as Promise<unknown>[], exits: 0 };
  const scope: TransitionScope = {
    showing: isOpen,
    leaving: signal(0),
    rendered: () => false,
    appear: false,
    hold: (wait: Promise<unknown>) => void (untrack(isOpen) || held.list.push(wait)),
    register: () => void held.exits++,
  };
  return {
    wrap: (render: () => JSX.Element) => (<TransitionScopeProvider value={scope}>{render}</TransitionScopeProvider>) as JSX.Element,
    take: () => (held.exits ? Promise.resolve().then(() => Promise.all(held.list.splice(0))) : undefined),
  };
}
overlayPresence.create = overlayScope;

/** `MotionConfig` values (accessors: live). */
interface Config {
  transition(): Transition | undefined;
  reducedMotion(): ReducedPolicy | undefined;
}
const ConfigContext = /*#__PURE__*/ createContext<Config | null>(null);

/** Defaults for the Motion elements inside: `transition` (under each element's own), `reducedMotion`. */
export function MotionConfig(props: { transition?: Transition; reducedMotion?: ReducedPolicy; children?: JSX.Element }): JSX.Element {
  const outer = useContext(ConfigContext);
  const value: Config = {
    transition: () => mergeTransition(outer?.transition(), props.transition, undefined),
    reducedMotion: () => props.reducedMotion ?? outer?.reducedMotion(),
  };
  return (
    <Provider token={ConfigContext} value={value}>
      {props.children}
    </Provider>
  ) as JSX.Element;
}

/** A variant parent's scope for its children: its labels (accessors) and orchestration. */
interface Scope {
  initial(): Definition | false | undefined;
  animate(): Definition | undefined;
  /** `delayChildren` / `staggerChildren` of the parent's current target (seconds; `delayChildren` may be `stagger(…)`). */
  orchestration(): Transition | undefined;
  /** The next child's creation index (CSS entrance stagger). */
  claim(): number;
}
/** `LayoutGroup` id (`@rivetjs/motion/layout`): prefixes the `layoutId`s inside it. */
export const LayoutGroupContext = /*#__PURE__*/ createContext<string | null>(null);

const VariantContext = /*#__PURE__*/ createContext<Scope | null>(null);

/** Child `i` of `total`'s delay (ms) from a parent's orchestration. */
function childDelay(t: Transition | undefined, i: number, total: number): number {
  const start = t?.delayChildren;
  return ((typeof start === "function" ? start(i, total) : (start ?? 0)) + i * (t?.staggerChildren ?? 0)) * 1000;
}
/** The CSS form of an orchestration (`start + index × each`, ms): `delayChildren(stagger(…))` probed as linear. */
function cssStagger(t: Transition | undefined): Stagger | undefined {
  if (!t || (t.delayChildren === undefined && t.staggerChildren === undefined)) return undefined;
  const d0 = childDelay(t, 0, 2);
  return { start: d0, each: childDelay(t, 1, 2) - d0 };
}

// Children re-targeted by one parent label change animate in DOM order (also after a reorder): their bindings queue
// here and run in one microtask, sorted by document position, with the parent's delays.
const queues = new Map<object, [Element, (delay: number) => void][]>();
function enqueue(key: object, t: Transition | undefined, el: Element, run: (delay: number) => void): void {
  let queue = queues.get(key);
  if (!queue) {
    queues.set(key, (queue = []));
    queueMicrotask(() => {
      queues.delete(key);
      queue!.sort(([a], [b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      queue!.forEach(([, go], i) => go(childDelay(t, i, queue!.length)));
    });
  }
  queue.push([el, run]);
}

// Module scope (not a local): resumed functions import it, so a browser recipe never sees the server's value.
const SERVER = typeof document === "undefined";
type RefProp = Ref<Element> | ((el: Element) => void) | undefined;
const isRef = (value: unknown): value is Ref<Element> => typeof value === "function" && typeof (value as { set?: unknown }).set === "function";

/** What a tag component (`tags/<tag>.tsx`) binds on its element: every value is resumable data or a resumable function. */
export interface Bound {
  /** Props for the element (`splitProps` rest: a forward to the props recipe on resumed pages). */
  rest: Record<string, unknown>;
  node: Ref<Element> | undefined;
  /** Live `animate` binding (`data-mv-t`, always `undefined`): runs before `style` (one attrs effect, in order). */
  live(): undefined;
  style(): StyleObject;
  mve?: string;
  mvv?: string;
  /** The element's `ref` + the gesture handler per event group present at creation (hover, press, focus): one spread,
   * so absent groups cost no attribute slot (server) and record nothing (resume). */
  bind: Record<string, unknown>;
  /** The gesture handler `bind` holds. */
  on(event: Event): void;
  /**
   * The hover group's `pointerenter` handler (`on`, undefined without one), written as its own attribute by the tags: an
   * event attribute whose value the build cannot tell is a function makes the tag component a conditional boundary
   * (STATIC-ZERO T3 `listens`), so an instance with gestures keeps its record and a cold resumed page wakes it on the
   * first pointer event (CTX-SOUND 2026-10-27); an instance without one records nothing.
   */
  enter: ((event: Event) => void) | undefined;
  /** Children (inside the variant scope when labels propagate). */
  content(): JSX.Element;
  /** Hands the element to a callback `ref` (client render), returns it. */
  mount<E>(element: E): E;
}

/**
 * The Motion element of `tag` (spec D9 / D10): props → what a compiled `<tag>` binds. Called in the tag component's
 * body (contexts are read here, never in bindings). Every prop is live except `initial` (read once: the entrance is the
 * mount) and which gesture groups exist.
 */
export function motionElement(props: Record<string, unknown>, tag: string, entrance?: Entrance): Bound {
  // Motion props are read from `props` itself (live, as a split part would forward them); only the rest is a copy.
  const own = props as unknown as LayerProps & MotionProps & { style?: unknown; ref?: unknown; children?: unknown };
  const rest = _restProps(props, OWN) as Record<string, unknown>;
  const sink = SERVER ? headSink() : undefined;
  const config = useContext(ConfigContext);
  const parent = useContext(VariantContext);
  // Variant inheritance: a child without its own `animate` / `initial` follows the parent's labels.
  const inherits = !!parent && untrack(() => own.inherit !== false);
  const animateDef = (): Definition | undefined => own.animate ?? (inherits ? parent!.animate() : undefined);
  const initialDef = (): Definition | false | undefined => (own.initial !== undefined ? own.initial : inherits ? parent!.initial() : undefined);
  const transitionOf = (target: Target | undefined) => mergeTransition(config?.transition(), own.transition, target?.transition as Transition | undefined);
  const reducedOf = (): ReducedPolicy => own.reducedMotion ?? config?.reducedMotion() ?? "user";
  // Presence: the enclosing kit transition scope. No entrance when it was already rendered at creation without
  // `appear` (`Presence initial={false}`, a kit Transition's first render), nor when created while its scope is leaving
  // (it exits from the final state).
  const presence = useTransitionScope();
  const quiet = !!presence && ((!presence.appear && untrack(presence.rendered)) || !untrack(presence.showing));
  // Captured by the live binding only with `exit` (a scope without exits never reaches the resume state).
  const exits = untrack(() => own.exit !== undefined) ? presence : null;
  exits?.register?.();
  // Entrance + first frame: read once.
  const { base, attrs, h, p, f, inView, scopes } = untrack(() => {
    const reduced = reducedOf();
    const animate = resolveTarget(animateDef(), own.variants, own.custom);
    const initialDefinition = initialDef();
    const initial = initialDefinition === false || quiet ? undefined : resolveTarget(initialDefinition, own.variants, own.custom);
    const inView = own.whileInView !== undefined;
    if (DEV) {
      const reason = (animate && hybridReason(animate, own.transition)) || (initial && hybridReason(initial));
      if (reason) throw new Error("@rivetjs/motion <Motion." + tag + ">: " + reason);
    }
    let base = finalState(animate, finalState(initial));
    // `viewport.ssr: "final"`: the in-view target is the first frame (visible without JS; nothing to animate on view).
    if (inView && own.viewport?.ssr === "final") base = finalState(resolveTarget(own.whileInView, own.variants, own.custom), base);
    const attrs: Record<string, string> = {};
    const index = inherits ? parent!.claim() : 0;
    if (initial && animate) {
      const transition = transitionOf(animate);
      const stagger = inherits ? cssStagger(parent!.orchestration()) : undefined;
      // Server: the head rule or the entrance.css form (`#server`); client render: the tags' `entrance` (css.ts).
      const lowered = SERVER
        ? serverEntrance(sink, initial, animate, transition, reduced, stagger, index)
        : entrance?.(initial, animate, transition, reduced, stagger, index);
      if (lowered) Object.assign(attrs, lowered);
    }
    // Gesture groups present at creation get the handler (read once: an element without gestures binds none, so
    // hovering it loads nothing on a resumed page); the user's own handlers of a group compose (they run first).
    const press = !!(own.whilePress || own.onPress || own.onPressStart || own.onPressEnd);
    return {
      base,
      attrs,
      h: !!(own.whileHover || own.onHoverStart || own.onHoverEnd || own.onPointerEnter || own.onPointerLeave),
      p: press || !!(own.onPointerDown || own.onPointerUp || own.onKeyDown || own.onKeyUp),
      f: press || !!(own.whileFocus || own.onFocusIn || own.onFocusOut),
      inView,
      // Variant labels (own or inherited) propagate to the children.
      scopes: !!(labelsOf(animateDef()) || labelsOf(initialDefinition || undefined)),
    };
  });
  const user = own.ref as RefProp;
  // Layout (read once): the attributes `/layout` finds (`animateLayout`, shared ids). A `layoutId` element created in
  // the browser takes the box of the element it replaces (still in the document while this one is created) and plays
  // from it after mount.
  const { layout, layoutId } = untrack(() => ({ layout: own.layout, layoutId: own.layoutId }));
  // The element handle only when something reads it (a user ref, gestures, in-view, exit, layout, a target that can
  // change): a static / entrance-only element allocates no `ref()` and records none (server cost per element).
  const changes = (key: string): boolean => {
    const d = Object.getOwnPropertyDescriptor(own, key);
    return !!d && (!!d.get || typeof d.value === "function");
  };
  const node: Ref<Element> | undefined = isRef(user)
    ? user
    : user !== undefined || h || p || f || inView || exits || layout || layoutId || inherits || changes("animate") || changes("variants") || changes("custom")
      ? elementRef<Element>()
      : undefined;
  let attributes = rest;
  let shared: DOMRect | undefined;
  if (layout || layoutId) {
    const group = useContext(LayoutGroupContext);
    const id = layoutId && (group ? group + "-" + layoutId : layoutId);
    // A policy other than `"user"` (own or MotionConfig's) travels with the element for `animateLayout`.
    const policy = untrack(reducedOf);
    attributes = _spreadProps(rest, {
      "data-layout": String(layout || true),
      "data-layout-id": id,
      "data-layout-reduced": policy === "user" ? undefined : policy,
    });
    if (id && !SERVER) {
      shared = layoutHook.from?.(id);
      // Removed before its replacement is created (sibling branches update in order): its box is kept for one frame.
      onCleanup(() => layoutHook.gone?.(id, untrack(node!)));
    }
  }
  let custom: string[] | undefined;
  for (const key in attrs) if (key.startsWith("--")) (custom ??= []).push(key);
  const layers = own as unknown as LayerProps;
  // Inline style: the user's (live) + the motion state (the element's current one once it animated; untracked) +
  // the fallback form's custom properties. Without a user style or custom properties: the state's style object as is.
  const style = (): StyleObject => {
    const el = node && untrack(node);
    const state: MotionState = el ? { ...base, ...motionState(el) } : base;
    const user = own.style as StyleObject | undefined;
    const motion = toStyle(state);
    if (!user && !custom) return motion;
    const out: Record<string, string | number | null | undefined | false> = { ...user, ...motion };
    if (custom) for (const key of custom) out[key] = attrs[key];
    return out;
  };
  const exitState = { on: false };
  // Live `animate` (own or the parent's labels): tracked by this binding; the first run (creation, server) only records
  // the target. Active gestures keep their keys over it (gestures.ts); inherited re-targets stagger in DOM order.
  const live = (): undefined => {
    const definition = animateDef();
    const target = resolveTarget(definition, own.variants, own.custom);
    const el = node && untrack(node);
    if (target && el?.isConnected && !SERVER)
      untrack(() => {
        const options = { transition: transitionOf(target), reduced: reducedOf(), report: true };
        if (own.animate === undefined && parent)
          enqueue(parent, parent.orchestration(), el, (delay) => animateLayers(el, layers, { ...options, definition, delay }));
        else animateLayers(el, layers, { ...options, definition });
      });
    // Exit: tracks the scope's target state; the exit animation holds the scope's unmount.
    if (exits && !SERVER) {
      const leaving = !exits.showing();
      if (leaving !== exitState.on) {
        exitState.on = leaving;
        const go = (el: Element | undefined) => {
          if (!el?.isConnected || exitState.on !== leaving) return;
          el.toggleAttribute("data-exiting", leaving);
          const run = setExit(el, layers, leaving, { definition, report: true, transition: transitionOf(undefined), reduced: untrack(reducedOf) });
          if (run && leaving) exits.hold(run.finished);
        };
        // Created while leaving (a resumed page re-creating the region on close): once mounted.
        if (el?.isConnected) untrack(() => go(el));
        else queueMicrotask(() => untrack(() => go(untrack(node!))));
      }
    }
    return undefined;
  };
  // Returned in the Bound literal (that makes it a resume symbol, recordable as a spread handler); groups absent at
  // creation hold `undefined` in `bind` (skipped by name: no attribute, no record).
  // Gestures and `whileInView` under MotionConfig and the variant parent's labels (both null on plain pages: no state).
  const on = (event: Event) => gesture(event, layers, config, parent);
  // Present keys only: the spread object is resume state (an absent group as `undefined` cost ~120 B per element).
  const bind: Record<string, unknown> = node ? { ref: node } : {};
  if (h) bind.onPointerLeave = on;
  if (p) bind.onPointerDown = bind.onPointerUp = bind.onKeyDown = bind.onKeyUp = on;
  if (f) bind.onFocusIn = bind.onFocusOut = on;
  // `whileInView`: from the element's first visibility (resumed pages: the `visible` trigger, no boot JS), Motion's
  // `inView` (root / margin / amount; loaded then: elements without `whileInView` never carry it) toggles the layer;
  // `once` keeps it after the first entry.
  if (inView)
    clientEffect(
      () => {
        const el = node!();
        if (!el) return;
        const viewport = untrack(() => own.viewport);
        const root = viewport?.root;
        let stop: (() => void) | undefined,
          stopped = false;
        void loadInView().then(({ inView: observe }) => {
          if (stopped) return;
          stop = observe(
            el,
            () => {
              setLayer(el, layers, "whileInView", true, config, parent);
              if (viewport?.once) queueMicrotask(() => stop?.());
              else return () => setLayer(el, layers, "whileInView", false, config, parent);
            },
            { root: (typeof root === "function" ? root() : root) ?? undefined, margin: viewport?.margin as never, amount: viewport?.amount },
          );
        });
        return () => {
          stopped = true;
          stop?.();
        };
      },
      { when: "visible" },
    );
  // This element's scope for variant children (labels: accessors, so a label change re-targets them).
  const children = { n: 0 };
  // Only an element whose labels propagate provides one (no scope allocation per plain element).
  const scope: Scope | undefined = scopes
    ? {
        initial: () => labelsOf(initialDef() || undefined),
        animate: () => labelsOf(animateDef()),
        orchestration: () => transitionOf(resolveTarget(animateDef(), own.variants, own.custom)),
        claim: () => children.n++,
      }
    : undefined;
  const content = (): JSX.Element =>
    scopes ? (
      <Provider token={VariantContext} value={scope!}>
        {own.children as JSX.Element}
      </Provider>
    ) : (
      (own.children as JSX.Element)
    );
  const mount = <E,>(element: E): E => {
    if (typeof user === "function" && !isRef(user) && !SERVER) user(untrack(node!)!);
    if (shared)
      queueMicrotask(() =>
        layoutHook.play?.(
          untrack(node!)!,
          shared!,
          String(layout || true),
          untrack(() => transitionOf(undefined)),
          untrack(reducedOf),
        ),
      );
    return element;
  };
  return { rest: attributes, node, live, style, mve: attrs["data-mve"], mvv: attrs["data-mvv"], bind, on, enter: h ? on : undefined, content, mount };
}
