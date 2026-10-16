// Browser resolution of the motion `#server` import (package.json): no head sink, no server entrance forms (the Motion
// element calls them only on the server).
import type { HeadSink } from "@rivetjs/router";
import type { ReducedPolicy, Stagger } from "./css.ts";
import type { Target, Transition } from "./values.ts";

export const headSink = (): HeadSink | undefined => undefined;
export const serverEntrance = (
  _sink: HeadSink | undefined,
  _initial: Target,
  _animate: Target,
  _transition: Transition | undefined,
  _reduced: ReducedPolicy,
  _stagger: Stagger | undefined,
  _index: number,
): Record<string, string> | undefined => undefined;
