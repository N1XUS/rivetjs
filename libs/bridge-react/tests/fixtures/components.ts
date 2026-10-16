// React fixture components (plain `createElement`: `.ts` keeps them out of Rivet's `.tsx` loader / compiler).
import { Component, Suspense, createElement as h, lazy, use, useId, useState, type ReactNode } from "react";

/** Renders per component name (live-props tests count React renders). */
export const renders: Record<string, number> = {};
const count = (name: string) => (renders[name] = (renders[name] ?? 0) + 1);

/** A counter: `count` prop, local clicks, `onIncrement(1)` callback, a `useId` id, an optional default slot. */
export function Counter(props: { count: number; label?: string; onIncrement?: (by: number) => void; children?: ReactNode }) {
  count("Counter");
  const id = useId();
  const [local, setLocal] = useState(0);
  return h(
    "div",
    { className: "counter", id },
    h("span", { className: "count" }, String(props.count)),
    h("i", { className: "local" }, String(local)),
    h("button", { className: "inc", onClick: () => (setLocal((n) => n + 1), props.onIncrement?.(1)) }, props.label ?? "+"),
    props.children !== undefined ? h("div", { className: "slot" }, props.children) : null,
  );
}

/** Named slots: `title` and `children`. */
export function Card(props: { title?: ReactNode; children?: ReactNode; tone?: string }) {
  return h("article", { className: "card " + (props.tone ?? "plain") }, h("h2", null, props.title), h("section", null, props.children));
}

/** React 19 hoistables: title, meta, stylesheet link. */
export function Hoisting(props: { text: string }) {
  return h(
    "div",
    { className: "hoist" },
    h("title", null, props.text + " & co"),
    h("meta", { name: "description", content: "about " + props.text }),
    h("link", { rel: "stylesheet", href: "/hoist.css", precedence: "default" }),
    props.text,
  );
}

const pending = new Map<string, Promise<string>>();
/** Suspends on a promise (resolved after `ms`): `renderToString` cannot wait, the stream path does. */
function Later(props: { value: string; ms: number }) {
  let promise = pending.get(props.value);
  if (!promise) pending.set(props.value, (promise = new Promise((resolve) => setTimeout(() => resolve(props.value), props.ms))));
  return h("b", { className: "later" }, use(promise));
}
export function Suspending(props: { value: string; ms?: number }) {
  return h("section", null, h(Suspense, { fallback: h("i", null, "wait") }, h(Later, { value: props.value, ms: props.ms ?? 5 })));
}

/** Suspends at the root, outside any Suspense boundary (`renderToString` throws; the stream waits). */
export function RootUse(props: { value: string }) {
  return h(Later, { value: "root:" + props.value, ms: 5 });
}
/** `React.lazy` island: the component module resolves later. */
export const LazyCard = lazy(async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return { default: (props: { title: string }) => h("p", { className: "lazy" }, props.title) };
});
/** An async function component (React 19 server rendering awaits it through the stream). */
export async function AsyncNote(props: { text: string }) {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return h("i", { className: "async" }, props.text);
}

/** Throws while rendering. */
export function Boom(props: { message: string }): ReactNode {
  throw new Error(props.message);
}
/** Throws inside a Suspense boundary (React would client-render it; the adapter rejects). */
export function SuspenseBoom(props: { message: string }) {
  return h(Suspense, { fallback: h("i", null, "wait") }, h(Boom, props));
}

/** A class component. */
export class Clock extends Component<{ at: string }> {
  override render() {
    return h("time", null, this.props.at);
  }
}

/** Server / client switch for the hydration-mismatch fixture (set while rendering the server HTML). */
export const env = { server: false };
/** Different text on the server and the client: React recovers by client rendering (onRecoverableError). */
export function Mismatch() {
  return h("p", { className: "mismatch" }, env.server ? "server" : "client");
}

/** Two buttons: `.stop` stops propagation in its React handler, `.go` does not. */
export function Stopper(props: { onHit?: (which: string) => void }) {
  return h(
    "div",
    { className: "stopper" },
    h("button", { className: "stop", onClick: (event: { stopPropagation(): void }) => (event.stopPropagation(), props.onHit?.("stop")) }, "stop"),
    h("button", { className: "go", onClick: () => props.onHit?.("go") }, "go"),
  );
}

/** Mismatching text next to a default slot: React recovers by client rendering the root; the slot hole is re-created. */
export function MismatchCard(props: { children?: ReactNode }) {
  return h("article", { className: "mm" }, h("p", null, env.server ? "server" : "client"), h("section", null, props.children));
}
