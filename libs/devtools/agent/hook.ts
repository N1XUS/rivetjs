// The page's devtools hook (`globalThis[Symbol.for("rivet.devtools")]`): the event sink the development
// façades report to. Created by the agent before app modules run; forwards each kept event to the agent
// synchronously and retains none (the model keeps what the panel reads, weakly where it can).
import type { DebugView, DevtoolsHook } from "@rivetjs/reactivity/debug";

export interface RawEvent {
  t: string;
  ts: number;
  d: Record<string, unknown>;
}
export interface AgentHook extends DevtoolsHook {
  /** The agent's listener, called synchronously for every kept event. */
  on: ((event: RawEvent) => void) | null;
}
export type { DebugView };

/** Rare events (hot, error, hmr, resume, route): kept at every level. */
const RARE = /^(?:hot|error|hmr|resume|route)\./;
export const isRare = (type: string): boolean => RARE.test(type);

export function createHook(level: 0 | 1 | 2 = 1, now: () => number = () => performance.now(), edit = true): AgentHook {
  const hook: AgentHook = {
    v: 1,
    level,
    stacks: false,
    // Debug overrides: the façades make computeds and props pinnable (dev-only internal signals).
    edit,
    on: null,
    emit(t, data) {
      if (hook.level < 1 && !isRare(t)) return;
      hook.on?.({ t, ts: now(), d: data as Record<string, unknown> });
    },
  };
  return hook;
}
