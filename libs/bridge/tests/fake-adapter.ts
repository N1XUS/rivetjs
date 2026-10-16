// A string-template "framework" for the core's server tests (framework-free): a component is a function of
// (props, slots, ctx) returning HTML (sync), a Promise of it (async), an `IslandRender` (hoisted head), or throwing.
import type { IslandContext, IslandRender, ServerAdapter, SlotMark } from "../adapter.ts";

export type FakeComponent = (
  props: Record<string, unknown>,
  slots: Record<string, SlotMark>,
  ctx: IslandContext,
) => string | IslandRender | Promise<string | IslandRender>;
const esc = (value: unknown) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** Every render call (props + slot names + ctx) of the current test. */
export const calls: { props: Record<string, unknown>; slots: string[]; ctx: IslandContext }[] = [];
export const fake: ServerAdapter<FakeComponent> = {
  name: "fake",
  render(component, props, slots, ctx) {
    calls.push({ props, slots: Object.keys(slots), ctx });
    return component(props, slots, ctx);
  },
};
/** An adapter with a page-level head script (Solid `_$HY`-style). */
export const fakeHead: ServerAdapter<FakeComponent> = { ...fake, name: "fake-head", head: (ctx) => `<script>fake(${JSON.stringify(ctx.id)})</script>` };

export const Counter: FakeComponent = (p, s) => `<div class="counter"><span>${esc(p.count)}</span>${s.default?.html ?? ""}</div>`;
export const Card: FakeComponent = (p, s, ctx) =>
  `<article id="${ctx.id}-card"><h2>${s.title?.html ?? ""}</h2>${s.default?.html ?? ""}<i>${esc(p.label)}</i></article>`;
export const Broken: FakeComponent = () => {
  throw new Error("boom");
};
export const Later: FakeComponent = async (p, s) => {
  await new Promise((resolve) => setTimeout(resolve, Number(p.ms ?? 1)));
  if (p.fail) throw new Error("late boom");
  return `<p>${esc(p.text)}</p>${s.default?.html ?? ""}`;
};
/** Pending until the request aborts; records the abort reason. */
export const aborted: unknown[] = [];
export const Hang: FakeComponent = (_p, _s, ctx) =>
  new Promise((_, reject) => ctx.signal.addEventListener("abort", () => (aborted.push(ctx.signal.reason), reject(ctx.signal.reason)), { once: true }));
export const Hoisting: FakeComponent = (p) => ({ html: `<p>${esc(p.text)}</p>`, head: { title: String(p.text) } });
export const NoHole: FakeComponent = () => "<p>no hole</p>";
export const TwoHoles: FakeComponent = (_p, s) => `<p>${s.default!.html}|${s.default!.html}</p>`;
/** Server twin of the client fake's `Counter` (`fake-client.ts`): a button the client attaches to. */
export const Clicker: FakeComponent = (p, s) => `<div class="counter"><span>${esc(p.count)}</span><button>+</button>${s.default?.html ?? ""}</div>`;
