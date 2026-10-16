// Leave guards (`beforeLeave`): client navigation (links and `navigate()`; the router client asks first),
// back/forward between router entries, and `beforeunload`. Tiny and dependency free, so leaf
// modules (forms autosave) import it alone.
/**
 * Leaving the page (`beforeLeave`): a client navigation (`link`: a link, `navigate()` or
 * `setSearchParams()`), back/forward between client-routed entries (`history`), or `unload`
 * (reload, close, a full page load).
 */
export interface LeaveEvent {
  readonly from: URL;
  /** Destination; null on unload (the browser does not tell). */
  readonly to: URL | null;
  /** `history`: back/forward; the address bar already shows `to` (a cancel walks back to `from`). */
  readonly type: "link" | "history" | "unload";
  /** Stay on the page. On unload the browser asks the user with its own dialog (custom text is not shown). */
  cancel(): void;
}
const leaveGuards = new Set<(leave: LeaveEvent) => void>();
/**
 * @internal The router client's guard checks, installed by the first `beforeLeave()`. Until then no
 * guard can exist and the router skips them, so apps that never call `beforeLeave` ship no guard code.
 */
export const _guard: { cancelled?: typeof _leaveCancelled; blocked?: typeof _popBlocked } = {};
/** @internal Run the guards for leaving to `to` (null: unload); true when one cancelled. */
export function _leaveCancelled(to: URL | null, from = new URL(location.href), type: LeaveEvent["type"] = to ? "link" : "unload"): boolean {
  if (!leaveGuards.size) return false;
  let cancelled = false;
  const leave: LeaveEvent = { from, to, type, cancel: () => void (cancelled = true) };
  for (const guard of leaveGuards) guard(leave);
  return cancelled;
}
function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!_leaveCancelled(null)) return;
  event.preventDefault();
  // Older browsers prompt only with a returnValue.
  event.returnValue = "";
}
// Set while `history.go` walks back to the guarded entry: that popstate is ours, not a navigation.
let restoring = false;
let last: Event | null = null, lastBlocked = false;
/**
 * @internal Back/forward guard. The router's popstate listeners (runtime router, router client) ask
 * first, so the answer is kept per event: true when the router must ignore this popstate (a guard
 * cancelled it, or it is the walk back). `committed`: the URL the routes region shows, `index` its
 * history entry index (`history.state.i`).
 */
export function _popBlocked(event: Event, committed: string, index: number): boolean {
  if (event !== last) (last = event), (lastBlocked = blocked(committed, index));
  return lastBlocked;
}
function blocked(committed: string, index: number): boolean {
  if (restoring) return !(restoring = false);
  if (!leaveGuards.size) return false;
  const from = new URL(committed), to = new URL(location.href);
  // Same page, another fragment: not leaving (fragment links are not guarded either).
  if (from.pathname === to.pathname && from.search === to.search) return false;
  const delta = index - ((history.state as { i?: number } | null)?.i ?? 0);
  // Entries the router did not number cannot be walked back to: let them through.
  if (!delta || !_leaveCancelled(to, from, "history")) return false;
  restoring = true;
  history.go(delta);
  return true;
}
/**
 * Guard leaving the page: `fn` runs before a client navigation (link, `navigate()`), on back/forward
 * between client-routed entries and on `beforeunload`; `leave.cancel()` keeps the page (ask first with
 * `confirm()`: `if (!confirm(msg)) leave.cancel()`; `leave.type` tells which). A cancelled back/forward
 * walks history back to the guarded entry (the router never sees either popstate). The `beforeunload`
 * listener exists only while a guard is registered (it keeps pages out of the back/forward cache).
 * Returns the unregister function.
 */
export function beforeLeave(fn: (leave: LeaveEvent) => void): () => void {
  if (typeof window === "undefined") return () => {};
  _guard.cancelled = _leaveCancelled;
  _guard.blocked = _popBlocked;
  if (!leaveGuards.size) addEventListener("beforeunload", onBeforeUnload);
  leaveGuards.add(fn);
  return () => {
    if (leaveGuards.delete(fn) && !leaveGuards.size) removeEventListener("beforeunload", onBeforeUnload);
  };
}
