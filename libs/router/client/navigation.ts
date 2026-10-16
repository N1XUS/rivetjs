// Navigation state shared by the router client, the lazy transitions module and resumed components.
// Kept tiny: the resume entry imports it (the context must exist before any component resumes).
import { createContext, signal, type Context, type Signal } from "@rivetjs/reactivity";

/** How a navigation started. */
export type NavigationType = "push" | "replace" | "back" | "forward";
/** State of the client navigation in flight (`useNavigation()`). */
export interface NavigationState {
  /** `submitting` is reserved for enhanced forms. */
  readonly state: "idle" | "loading" | "submitting";
  /** Destination of the navigation in flight. */
  readonly location: URL | null;
  readonly from: URL | null;
  readonly type: NavigationType | null;
  /** Indicator visible: set after `pending.delay`, kept at least `pending.minDuration`. */
  readonly shown: boolean;
}
/** Navigation state when nothing is loading. */
export const IDLE: NavigationState = Object.freeze({ state: "idle", location: null, from: null, type: null, shown: false });

/** Browser navigation state (the transitions module writes it; idle on the server and without transitions). */
export const navigation: Signal<NavigationState> = signal<NavigationState>(IDLE);
/**
 * Resumable navigation context: the server entry provides `navigation` under this id, so resumed
 * regions that read it revive to the browser signal (`createResume({ contexts })`).
 */
export const Navigation: Context<() => NavigationState> = createContext<() => NavigationState>(navigation, { id: "rivet:navigation" });

/** @internal Route commits record the shown search and run `search` (set by search.ts when loaded). */
export const _searchSync: { shown?: string; search?: () => void } = {};
