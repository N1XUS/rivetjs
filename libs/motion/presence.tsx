// @rivetjs/motion/presence: `Presence` / `PresenceFor` (spec D7 / D8) on kit `createTransition`. A presence scope is a
// kit transition scope: Motion elements with `exit` inside one (also any kit `Transition`, cdk Popover) play their exit
// when it leaves and `hold` its unmount until the exit animation finished (element.tsx). No class phases: the scope
// renders no element of its own; entrances are the Motion elements' CSS (`initial={false}` skips them on the first
// render through the scope's `appear`).
//
// `PresenceFor` keeps a derived row list (current rows ∪ exiting rows at their last index) over a plain `For` (no
// runtime / `For` ABI change): one presence scope per row, a removed key's row leaves in place (after the row it
// followed), then drops out; a key added back while its row leaves reverses it (same row, no duplicate).
import { _regionState, computed, onCleanup, signal, untrack } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { createTransition, TransitionScopeProvider, type TransitionScope } from "@rivetjs/kit/transition";

type MaybeAccessor<T> = T | (() => T);
const read = <T,>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

export interface PresenceProps {
  /** Shown while true (a value, a signal or an accessor). */
  show: MaybeAccessor<boolean>;
  /** `false`: Motion elements rendered with the first render skip their entrance (Motion's `AnimatePresence initial`). */
  initial?: boolean;
  /** `false`: keep the content in the DOM (hidden) after the exit instead of removing it. */
  unmount?: boolean;
  /** After the exit finished and the content was removed. */
  onExitComplete?(): void;
  /** @internal Shown before this instance was created (a resumed PresenceFor row): created hidden, it still exits. */
  shown?: boolean;
  /** The content (a function: created while shown, inside the presence scope). */
  children: () => Content;
}

/** Content shown while `show`, kept until the exits of the Motion elements inside finished. */
export function Presence(props: PresenceProps): JSX.Element {
  // `shown` (PresenceFor on a resumed page re-creating its rows after a removal): the content was shown on the server;
  // created already hidden, it starts shown and leaves a microtask later, so the exit still plays.
  const leaving = signal(!!props.shown && !untrack(() => read(props.show)));
  if (untrack(leaving)) queueMicrotask(() => leaving.set(false));
  const show = () => leaving() || read(props.show);
  const t = createTransition(show, { unmount: props.unmount });
  const scope: TransitionScope = { ...t.scope, appear: untrack(() => props.initial !== false) };
  const children = props.children;
  // Keyed per instance, like kit `TransitionPresence`: a resumed page re-creating this region builds new content.
  const instance = {};
  return (
    <Show when={() => t.mounted() && instance} keyed>
      {() => (
        <TransitionScopeProvider value={scope}>
          {() => {
            onCleanup(() => untrack(show) || props.onExitComplete?.());
            return children();
          }}
        </TransitionScopeProvider>
      )}
    </Show>
  ) as JSX.Element;
}

export interface PresenceForProps<T, K> {
  each: MaybeAccessor<readonly T[]>;
  /** Row key (like `For`'s `by`; derive it from the item: a leaving row is keyed at its new index). */
  by: (item: T, index: number) => K;
  /** `false`: rows rendered with the first render skip their entrance. */
  initial?: boolean;
  /** A removed row finished its exit and was dropped. */
  onExitComplete?(key: K): void;
  children: (item: () => T, index: () => number) => Content;
}

/** A keyed list whose removed rows stay at their index, marked `data-exiting` (Motion elements), until their exit finished. */
export function PresenceFor<T, K>(props: PresenceForProps<T, K>): JSX.Element {
  const each = () => read(props.each);
  const keys = computed(() => new Set(each().map((item, i) => props.by(item, i))));
  // Rows whose exit finished (dropped from the list); a key that comes back leaves this set.
  const done = signal(new Set<K>());
  // The rows are the items themselves (current + leaving), so `For`'s own item accessor reaches the children: it
  // resumes (a wrapper accessor would not be serializable in a resumed handler).
  // `_regionState`: a resumed page re-creates this component on the first change (its root `For` has no region of
  // its own); it continues from the server's rows, so a removed row still leaves in place.
  const memory = _regionState(() => ({ rows: [] as { key: K; item: T }[] }));
  // Re-created that way: the server's rows are on screen already (no entrance replay; only new keys enter), and the
  // ones that are gone now still play their exit.
  const server = new Set(memory.rows.map((row) => row.key));
  const resumed = untrack(() => {
    const now = keys();
    return new Set(memory.rows.filter((row) => !now.has(row.key)).map((row) => row.key));
  });
  const rows = computed(() => {
    const current = each();
    const gone = done();
    const next = current.map((item, i) => ({ key: props.by(item, i), item }));
    // Leaving rows stay after the row they followed (no DOM move: moving an element cancels its running animations).
    const at = new Map(next.map((row, i) => [row.key, i]));
    const out: { key: K; item: T }[] = [];
    let from = 0;
    for (const row of memory.rows) {
      const index = at.get(row.key);
      if (index !== undefined) {
        while (from <= index) out.push(next[from++]!);
      } else if (!gone.has(row.key)) out.push(row);
    }
    while (from < next.length) out.push(next[from++]!);
    memory.rows = out;
    return out.map((row) => row.item);
  });
  const keyOf = (item: T, index: number) => (memory.rows[index]?.item === item ? memory.rows[index]!.key : props.by(item, index));
  const first = { render: true };
  const initial = untrack(() => props.initial);
  const finished = (key: K) => {
    if (untrack(keys).has(key)) return;
    done.set(new Set(untrack(done)).add(key));
    props.onExitComplete?.(key);
    // Dropped: a later add of the key starts fresh.
    queueMicrotask(() => {
      const set = new Set(untrack(done));
      set.delete(key);
      done.set(set);
    });
  };
  const list = (
    <For each={rows} by={keyOf}>
      {(item, index) => (
        <Presence
          show={() => keys().has(keyOf(item(), index()))}
          initial={first.render ? (server.has(keyOf(item(), index())) ? false : initial) : true}
          shown={first.render && resumed.has(keyOf(item(), index()))}
          onExitComplete={() => finished(keyOf(item(), index()))}
        >
          {() => props.children(item, index)}
        </Presence>
      )}
    </For>
  ) as JSX.Element;
  first.render = false;
  return list;
}
