// Enter / leave transitions for content that mounts and unmounts (overlays, menus, toasts, panels).
//
//   <Transition show={open} enter="transition duration-200" enterFrom="opacity-0" enterTo="opacity-100"
//     leave="transition duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">…</Transition>
//
// Class props follow Headless UI (enter, enterFrom, enterTo, entered, leave, leaveFrom, leaveTo); the
// element also carries Headless UI v2 data attributes (`data-closed`, `data-enter`, `data-leave`,
// `data-transition`) for `data-[closed]:opacity-0`-style CSS, and, with `ariaComponents`,
// react-aria-components' `data-entering` / `data-exiting`. Content stays mounted until the element's
// CSS transitions and animations finish (`element.getAnimations()`), then unmounts (or gets `hidden`
// with `unmount={false}`).
//
// Resumable at zero JS: all state is signals and refs, and the phase machine is driven from the
// bindings that read `show`, so a server-rendered page loads this code only when `show` changes.
import { computed, createContext, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Dynamic, Provider, Show, clientEffect, ref, type Ref } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

/** Transition phases. `hidden`: unmounted (or `hidden`); `shown`: settled open. */
export type TransitionPhase = "hidden" | "enter-from" | "enter-to" | "shown" | "leave-from" | "leave-to";

export interface TransitionClasses {
  /** Classes for the whole enter phase (e.g. `transition duration-200`). */
  enter?: string;
  /** Classes at the first frame of enter. */
  enterFrom?: string;
  /** Classes from the second frame of enter until it finishes. */
  enterTo?: string;
  /** Classes once entered (settled open). */
  entered?: string;
  /** Classes for the whole leave phase. */
  leave?: string;
  /** Classes at the first frame of leave. */
  leaveFrom?: string;
  /** Classes from the second frame of leave until it finishes. */
  leaveTo?: string;
}

export interface TransitionOptions extends TransitionClasses {
  /** Run the enter transition when the content is shown on first render (in the browser). */
  appear?: boolean;
  /** Remove the content when hidden (default). `false` keeps it in the DOM with `hidden`. */
  unmount?: boolean;
  /** Also set react-aria-components' `data-entering` / `data-exiting`. */
  ariaComponents?: boolean;
}

/** What a transition shares with nested transitions (`TransitionChild`). */
export interface TransitionScope {
  /** Target state (`show`). */
  showing: () => boolean;
  /** Nested transitions still leaving: the parent unmounts once its own leave and theirs are done. */
  leaving: Signal<number>;
  /** Whether the element is rendered (shown or transitioning): where nested transitions start. */
  rendered: () => boolean;
  appear: boolean;
  /**
   * Keep the running enter / leave going until `wait` settles too (a JS animation inside: `@rivetjs/motion` exits). The
   * transition settles once its element's CSS transitions and every promise held for that run are done (also one held
   * right after `show` changed, before the run started). Ignored while settled where `show` points; a run in the other
   * direction (interruption) drops the holds.
   */
  hold(wait: Promise<unknown>): void;
  /** A nested element with an exit announces itself at creation (overlay scopes wait for holds only then). */
  register?(): void;
}
const Scope = /*#__PURE__*/ createContext<TransitionScope | null>(null);

/** An overlay's presence scope for nested exits (cdk Modal: `@rivetjs/motion` elements with `exit` in its content). */
export interface OverlayPresence {
  /** The overlay content inside the scope. */
  wrap(render: () => Content): JSX.Element;
  /** The exits held for this close, once the close's bindings ran (undefined: no element with an exit registered). */
  take(): Promise<unknown> | undefined;
}
/**
 * Filled by `@rivetjs/motion` (its element module): overlays create their presence scope through it, so an overlay pays
 * nothing (bytes or work) in a bundle without Motion elements.
 */
export const overlayPresence: { create?(isOpen: () => boolean): OverlayPresence } = {};

/** The enclosing transition's scope (read in the component body), or `null` outside any transition. */
export const useTransitionScope = (): TransitionScope | null => useContext(Scope);

/** Transition state of one element: mount state, phase, classes and data attributes. */
export interface TransitionController {
  phase: () => TransitionPhase;
  /** Whether the element is rendered (also while leaving). */
  mounted: () => boolean;
  /** Class names for the current phase, after `base`. */
  className: (base?: string) => string;
  /** Data attributes (and `hidden` with `unmount: false`) for the current phase. */
  attributes: () => Record<string, string | boolean | undefined>;
  /** Put on the element that transitions. */
  ref: Ref<HTMLElement>;
  /** Value for `<TransitionScopeProvider>` around nested transitions. */
  scope: TransitionScope;
}

const join = (...names: (string | undefined)[]) => names.filter(Boolean).join(" ");

/** The element's running CSS transitions / animations, finished (at once when there are none). */
export function transitionsSettled(element: Element | undefined): Promise<unknown> {
  if (!element || !element.isConnected) return Promise.resolve();
  if (typeof element.getAnimations === "function")
    return Promise.allSettled(
      element
        .getAnimations()
        .filter((a) => a.playState !== "finished")
        .map((a) => a.finished),
    );
  // No Web Animations API: the longest transition / animation from the computed style.
  const style = getComputedStyle(element);
  const longest = (durations: string, delays: string) => {
    const delay = delays.split(",").map(parseFloat);
    return Math.max(0, ...durations.split(",").map((d, i) => (parseFloat(d) + (delay[i % delay.length] ?? 0)) * 1000));
  };
  const ms = Math.max(longest(style.transitionDuration, style.transitionDelay), longest(style.animationDuration, style.animationDelay));
  return ms ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/** The phase to render: a `show` that changed before the phase machine caught up renders as the first frame. */
const visible = (target: boolean, phase: TransitionPhase): TransitionPhase =>
  target && (phase === "hidden" || phase === "leave-from" || phase === "leave-to")
    ? "enter-from"
    : !target && (phase === "shown" || phase === "enter-from" || phase === "enter-to")
      ? "leave-from"
      : phase;

/**
 * Transition state for one element shown while `show` is true (a signal, an accessor or a value;
 * without it, the enclosing transition's state). Render while `mounted()`, put `ref`, `attributes()`
 * and `className()` on the element. Inside another transition's scope it also holds the parent's
 * unmount until it has left.
 */
export function createTransition(source: boolean | (() => boolean) | undefined, options: TransitionOptions = {}): TransitionController {
  const parent = useContext(Scope);
  if (source === undefined && !parent) throw new Error("createTransition: `show` is required outside another transition");
  const show = () => (source === undefined ? parent!.showing() : typeof source === "function" ? source() : source);
  const appear = options.appear ?? parent?.appear ?? false;
  const initial = untrack(show);
  // Where to start: a nested transition starts like its parent (rendered: shown, also while the parent leaves).
  const start = source === undefined && parent ? untrack(parent.rendered) : initial;
  const phase = signal<TransitionPhase>(start && !appear ? "shown" : "hidden");
  const leaving = signal(0);
  /** Whether this transition counts in the parent's `leaving`. */
  const holding = signal(false);
  /** Own leave finished while nested transitions were still leaving. */
  const waiting = signal(false);
  const element = ref<HTMLElement>();
  /** Promises held for the run towards `to` (`hold`); a run in the other direction starts a new list. */
  const held = { to: "", list: [] as Promise<unknown>[] };
  /** Runs started (the latest one steps the phase). */
  const runs = { n: 0 };
  const towards = (to: "shown" | "hidden") => {
    if (held.to !== to) ((held.to = to), (held.list = []));
    return held.list;
  };
  const hold = (wait: Promise<unknown>) => {
    const target = untrack(show);
    const current = untrack(phase);
    // Settled where `show` points: nothing runs. Else a run is on (or queued: a binding of the content saw the change first).
    if (current !== (target ? "shown" : "hidden")) towards(target ? "shown" : "hidden").push(wait);
  };
  /** Settled once the element's transitions and the run's holds (also those added meanwhile) are done. */
  const done = (list: Promise<unknown>[]): Promise<unknown> => {
    const n = list.length;
    return Promise.allSettled([transitionsSettled(element()), ...list]).then(() => (list.length > n ? done(list) : undefined));
  };

  const release = () => {
    if (parent && holding()) {
      holding.set(false);
      parent.leaving.update((n) => n - 1);
    }
  };
  const settle = (end: "shown" | "hidden") => {
    if (end === "hidden" && leaving() > 0) return waiting.set(true); // nested still leaving: `sync` ends it
    waiting.set(false);
    phase.set(end);
    if (end === "hidden") release();
  };
  const run = (from: TransitionPhase, to: TransitionPhase, end: "shown" | "hidden") => {
    if (end === "hidden" && parent && !holding()) {
      holding.set(true);
      parent.leaving.update((n) => n + 1);
    }
    if (end === "shown") release();
    // Holds of this direction (also ones registered before the run started, or by a repeated run) are kept.
    const list = towards(end);
    // Only the latest run steps: a quick close → open → close leaves an older chain of the same direction pending,
    // which would otherwise move the phase under the newer one.
    const id = ++runs.n;
    const current = () => runs.n === id;
    phase.set(from);
    // Two frames: the `from` styles apply before the `to` classes go on; one more for the bindings to
    // put the `to` classes on the element, so its transitions have started when they are collected.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (phase() !== from || !current()) return; // interrupted by the opposite change
        phase.set(to);
        requestAnimationFrame(() => {
          if (phase() !== to || !current()) return;
          void done(list).then(() => {
            if (phase() === to && current()) settle(end);
          });
        });
      }),
    );
  };

  /** Steer towards `show()`; runs from the bindings that read it (they rerun in the browser on change). */
  const sync = (target: boolean, nestedLeaving: number) => {
    if (typeof requestAnimationFrame !== "function") return; // server render
    untrack(() => {
      const current = phase();
      if (target && (current === "hidden" || current === "leave-from" || current === "leave-to")) queueMicrotask(() => run("enter-from", "enter-to", "shown"));
      else if (!target && (current === "shown" || current === "enter-from" || current === "enter-to"))
        queueMicrotask(() => run("leave-from", "leave-to", "hidden"));
      else if (!target && current === "leave-to" && nestedLeaving === 0 && waiting())
        queueMicrotask(() => phase() === "leave-to" && waiting() && leaving() === 0 && settle("hidden")); // nested ones done
    });
  };

  // `appear` on a server-rendered page: nothing reruns the bindings until `show` changes, so start the
  // enter once the page is ready (only components with `appear` record this effect).
  if (appear && initial) clientEffect(() => sync(untrack(show), untrack(leaving)), { when: "load" });

  const mounted = computed(() => {
    const target = show();
    sync(target, leaving());
    return options.unmount === false || target || phase() !== "hidden";
  });
  const rendered = () => phase() !== "hidden";
  const attributes = () => {
    const target = show();
    sync(target, leaving());
    const shown = visible(target, phase());
    const entering = shown === "enter-from" || shown === "enter-to";
    const exiting = shown === "leave-from" || shown === "leave-to";
    return {
      "data-closed": shown === "enter-from" || shown === "leave-to" || shown === "hidden" ? "" : undefined,
      "data-enter": entering ? "" : undefined,
      "data-leave": exiting ? "" : undefined,
      "data-transition": entering || exiting ? "" : undefined,
      ...(options.ariaComponents
        ? {
            "data-entering": entering ? "" : undefined,
            "data-exiting": exiting ? "" : undefined,
          }
        : {}),
      ...(options.unmount === false ? { hidden: shown === "hidden" } : {}),
    };
  };
  const className = (base?: string) => {
    switch (visible(show(), phase())) {
      case "enter-from":
        return join(base, options.enter, options.enterFrom);
      case "enter-to":
        return join(base, options.enter, options.enterTo);
      case "shown":
        return join(base, options.entered);
      case "leave-from":
        return join(base, options.leave, options.leaveFrom);
      case "leave-to":
        return join(base, options.leave, options.leaveTo);
      default:
        return join(base, options.leaveTo);
    }
  };

  return {
    phase,
    mounted,
    className,
    attributes,
    ref: element,
    scope: { showing: show, leaving, rendered, appear, hold },
  };
}

/** Provide a transition's scope to nested transitions (`createTransition` users; `<Transition>` does it). */
export function TransitionScopeProvider(props: { value: TransitionScope; children?: Content | (() => Content) }) {
  const children = props.children;
  return (
    <Provider token={Scope} value={props.value}>
      {typeof children === "function" ? (children as () => Content)() : children}
    </Provider>
  );
}

export interface TransitionProps extends TransitionOptions {
  /** Shown while true (a signal, an accessor or a value). Without it: the enclosing transition's state. */
  show?: boolean | (() => boolean);
  /** Element to render (default `div`). */
  as?: string;
  class?: string;
  /** Content. Pass a function (`{() => …}`) for nested `<TransitionChild>`ren: plain children render
   *  before this component, outside the scope it provides. */
  children?: Content | (() => Content);
  [attribute: string]: unknown;
}

const OWN = new Set([
  "show",
  "as",
  "class",
  "children",
  "appear",
  "unmount",
  "ariaComponents",
  "enter",
  "enterFrom",
  "enterTo",
  "entered",
  "leave",
  "leaveFrom",
  "leaveTo",
]);

/**
 * Renders `children()` while `transition` is mounted, with its scope for nested transitions. For
 * elements `<Transition>` does not cover (an overlay's element inside a portal, say): put the
 * controller's `ref`, `attributes()` and `className()` on the element.
 */
export function TransitionPresence(props: { transition: TransitionController; children: () => Content }) {
  const t = props.transition;
  const children = props.children;
  // Keyed by an object per instance: a resumed page re-creating this (server-rendered) region builds a
  // new element rather than adopting the server one, whose bindings belong to the server render's state.
  const instance = {};
  return (
    <Show when={() => t.mounted() && instance} keyed>
      {() => (
        <Provider token={Scope} value={t.scope}>
          {children()}
        </Provider>
      )}
    </Show>
  );
}

/**
 * Renders `as` (default `div`) while shown and through its leave. Nested `<TransitionChild>`ren (a
 * backdrop and a panel, say) follow its `show`, and it unmounts after all of them have left.
 */
export function Transition(props: TransitionProps) {
  if (props.show === undefined && !useContext(Scope)) throw new Error("<Transition>: `show` is required outside another <Transition>");
  const t = createTransition(props.show, props);
  const content = () => (typeof props.children === "function" ? (props.children as () => Content)() : props.children);
  const rest: Record<string, unknown> = {};
  for (const key in props) if (!OWN.has(key)) rest[key] = props[key];
  return (
    <TransitionPresence transition={t}>
      {() =>
        props.as && props.as !== "div" ? (
          <Dynamic component={props.as} {...rest} {...t.attributes()} class={t.className(props.class)} ref={t.ref}>
            {content()}
          </Dynamic>
        ) : (
          <div {...rest} {...t.attributes()} class={t.className(props.class)} ref={t.ref}>
            {content()}
          </div>
        )
      }
    </TransitionPresence>
  );
}

/** A part that transitions with the enclosing `<Transition>` (its `show`; the parent waits for it to leave). */
export function TransitionChild(props: Omit<TransitionProps, "show">) {
  return <Transition {...props} />;
}
