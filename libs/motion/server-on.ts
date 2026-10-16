// Server half of the Motion element (default resolution of the motion `#server` import, package.json; browsers resolve
// `server-off.ts`): the route head sink and the server entrance forms, kept off the client graph.
import { useContext } from "@rivetjs/reactivity";
import { ServerData } from "@rivetjs/router/route-context";
import type { HeadSink } from "@rivetjs/router";
import { DEV } from "#dev";
import { entranceRule, entranceVars, type ReducedPolicy, type Stagger } from "./css.ts";
import { cached, sig } from "./memo.ts";
import type { Target, Transition } from "./values.ts";

/** The route's head sink (`@rivetjs/router` pages), read in the component body. */
export const headSink = (): HeadSink | undefined => useContext(ServerData)?.headSink;

// Entrance rules per head sink (one push per hash per page: true = in the head; false = the sink was past the shell,
// a streamed boundary).
const pushed = new WeakMap<object, Map<string, boolean>>();
function inHead(sink: HeadSink, hash: string, css: string): boolean {
  let seen = pushed.get(sink);
  if (!seen) pushed.set(sink, (seen = new Map()));
  let head = seen.get(hash);
  if (head === undefined) seen.set(hash, (head = !sink.push(0, { styles: [{ css, key: "rv-mve-" + hash }] }, "<Motion>")));
  return head;
}

/**
 * The entrance attributes of a server-rendered element: the generated rule in the head (`data-mve`), else (no head sink,
 * or a streamed boundary after the shell) the custom-property form of `entrance.css` (`data-mvv` + `--rv-mve-*`).
 */
export function serverEntrance(
  sink: HeadSink | undefined,
  initial: Target,
  animate: Target,
  transition: Transition | undefined,
  reduced: ReducedPolicy,
  stagger: Stagger | undefined,
  index: number,
): Record<string, string> | undefined {
  const rule = sink ? cached("r" + sig(stagger), initial, animate, transition, reduced, stagger, entranceRule) : undefined;
  if (rule && inHead(sink!, rule.hash, rule.css)) return stagger?.each ? { "data-mve": rule.hash, "--rv-mvi": String(index) } : { "data-mve": rule.hash };
  if (!rule && sink) return undefined;
  const extra = stagger ? stagger.start + index * stagger.each : 0;
  const vars = cached("v" + extra, initial, animate, transition, reduced, extra, entranceVars);
  if (typeof vars === "string") {
    if (DEV) console.warn("@rivetjs/motion: entrance rendered as its final state: " + vars);
    return undefined;
  }
  return vars ? { "data-mvv": "", ...vars } : undefined;
}
