// Preact fixture components (plain `h`: `.ts` keeps them out of Rivet's `.tsx` loader / compiler).
import { Component, h, type ComponentChildren } from "preact";
import { useId, useState } from "preact/hooks";
import { Suspense, lazy } from "preact/compat";

/** Renders per component name (live-props tests count Preact renders). */
export const renders: Record<string, number> = {};
const count = (name: string) => (renders[name] = (renders[name] ?? 0) + 1);

/** A counter: `count` prop, local clicks, `onIncrement(1)` callback, a `useId` id, an optional default slot. */
export function Counter(props: { count: number; label?: string; onIncrement?: (by: number) => void; children?: ComponentChildren }) {
  count("Counter");
  const id = useId();
  const [local, setLocal] = useState(0);
  return h(
    "div",
    { class: "counter", id },
    h("span", { class: "count" }, String(props.count)),
    h("i", { class: "local" }, String(local)),
    h("button", { class: "inc", onClick: () => (setLocal((n) => n + 1), props.onIncrement?.(1)) }, props.label ?? "+"),
    props.children !== undefined ? h("div", { class: "slot" }, props.children) : null,
  );
}

/** Named slots: `title` and `children`. */
export function Card(props: { title?: ComponentChildren; children?: ComponentChildren; tone?: string }) {
  return h("article", { class: "card " + (props.tone ?? "plain") }, h("h2", null, props.title), h("section", null, props.children));
}

/** A class component. */
export class Clock extends Component<{ at: string }> {
  render() {
    return h("time", null, this.props.at);
  }
}

const pending = new Map<string, { done: boolean; promise: Promise<void> }>();
/** Throws a promise until it resolves after `ms` (Suspense protocol). */
function Later(props: { value: string; ms: number }) {
  let entry = pending.get(props.value);
  if (!entry) {
    const created = { done: false, promise: Promise.resolve() };
    created.promise = new Promise<void>((resolve) => setTimeout(() => ((created.done = true), resolve()), props.ms));
    pending.set(props.value, (entry = created));
  }
  if (!entry.done) throw entry.promise;
  return h("b", { class: "later" }, props.value);
}
export function Suspending(props: { value: string; ms?: number }) {
  return h("section", null, h(Suspense, { fallback: h("i", null, "wait") }, h(Later, { value: props.value, ms: props.ms ?? 5 })));
}
/** A root that suspends outside any boundary. */
export function RootLater(props: { value: string }) {
  return h(Later, { value: "root:" + props.value, ms: 5 });
}
/** `lazy` from preact/compat. */
const LazyInner = lazy(async () => ({ default: (props: { title: string }) => h("p", { class: "lazy" }, props.title) }));
/** A `lazy` component needs a `Suspense` above it in Preact (server and client). */
export const LazyCard = (props: { title: string }) => h(Suspense, { fallback: null }, h(LazyInner, props));

/** Throws while rendering. */
export function Boom(props: { message: string }): never {
  throw new Error(props.message);
}

/** Server / client switch for the hydration-mismatch fixture (set while rendering the server HTML). */
export const env = { server: false };
/** Different text on the server and the client: Preact patches it in place during hydration. */
export function Mismatch() {
  return h("p", { class: "mismatch" }, env.server ? "server" : "client");
}
/** Mismatching text next to a default slot. */
export function MismatchCard(props: { children?: ComponentChildren }) {
  return h("article", { class: "mm" }, h("p", null, env.server ? "server" : "client"), h("section", null, props.children));
}

/** Two buttons: `.stop` stops propagation in its Preact handler, `.go` does not. */
export function Stopper(props: { onHit?: (which: string) => void }) {
  return h(
    "div",
    { class: "stopper" },
    h("button", { class: "stop", onClick: (event: Event) => (event.stopPropagation(), props.onHit?.("stop")) }, "stop"),
    h("button", { class: "go", onClick: () => props.onHit?.("go") }, "go"),
  );
}

/** `useId` on the root and in a child that mounts only once `open` is true (ids after a live-prop update). */
export function IdLater(props: { open: boolean }) {
  const id = useId();
  return h("div", { class: "ids", id }, props.open ? h(IdChild, null) : null);
}
function IdChild() {
  const id = useId();
  return h("span", { class: "child", id }, id);
}

/** Throws during its first client render only (hydration), renders on the server and on the mount-over. */
export const hydrateBoom = { armed: false };
export function HydrateBoom(props: { children?: ComponentChildren }) {
  if (!env.server && hydrateBoom.armed) {
    hydrateBoom.armed = false;
    throw new Error("hydrate boom");
  }
  return h("article", { class: "hb" }, h("p", null, "ok"), h("section", null, props.children));
}

/** A `<title>` / `<meta>` inside an island: Preact has no hoistables, they render inline. */
export function Titled(props: { title: string }) {
  return h("div", { class: "titled" }, h("title", null, props.title), h("meta", { name: "x", content: "y" }));
}

/** Suspends, then throws inside a `Suspense` boundary: renderToStringAsync rejects. */
let late: Promise<void> | null = null;
function LateBoom(props: { message: string }): never {
  if (!late) {
    late = new Promise<void>((resolve) => setTimeout(resolve, 1));
    throw late;
  }
  throw new Error(props.message);
}
export function SuspenseBoom(props: { message: string }) {
  return h(Suspense, { fallback: h("i", null, "wait") }, h(LateBoom, props));
}
