// libs/reactivity/index.ts — _dispatch: every DOM event handler goes through here.
// The Chrome first-mouse-click stall: a synchronous DOM change inside the FIRST trusted mouse click
// in a tab stalls the next frame 25–45 ms (main thread idle in BeginMainFrame until the hover-update
// mousemove). Keyboard: 1 ms. Touch: no stall. Later clicks: no stall. Deferring EVERY click made
// later clicks a frame slower (headless 16 → 33 ms). So: defer the flush one task, once per document.
export function _dispatch(owner, handler, target, event, onError?): void {
  const node = owner as unknown as Owner | null;
  if (node !== null && node.disposed) return;
  // Another event: the previous click's DOM updates land before its handlers run.
  if (held !== null && event !== heldEvent) held();
  // Chrome (headless + headed) stalls the frame after the first mouse click of a tab whose task changed the DOM
  // (main thread idle in BeginMainFrame ~25–45 ms; click→paint p50 headless 45–62 ms sync vs 32 ms with the DOM
  // write one task later, headed 47 vs 13). Once a click's DOM change landed, later clicks paint in ~1 frame
  // when synchronous and ~2 deferred (headless 16 vs 32 ms, headed 6 vs 13): so only the first mouse click per
  // document (`view`) whose handlers queued effects defers. Only the flush moves: the handler, its
  // preventDefault / stopPropagation and signal writes (reads see new values) stay synchronous. Keyboard /
  // touch / pen / synthetic clicks measured no stall (touch: deferring is slower): they flush now.
  const view = (event as UIEvent).view;
  if (batchDepth || flushing || !event.isTrusted || event.type !== 'click' || (event as PointerEvent).pointerType !== 'mouse' || !view ||
      (event !== heldEvent && settled !== null && settled.has(view))) {
    batched(callIn, node, handler, target, event);
    return;
  }
  // Handlers of the same event (bubbling path, a taken-over spread) share one deferred flush.
  held = null;
  inEvent = false;
  batchDepth++;
  try { callIn(node, handler, target, event); }
  finally {
    batchDepth--;
    if (queue.length) {
      if (inEvent) {
        // `_flushInEvent()`: the update replaces content under the pointer (navigation). Chrome's hover update
        // stalls that frame either way, deferring only adds one (bare page, headless click→paint: sync 51–60 ms,
        // deferred 61–74); the click's DOM change still consumes the document's first-click stall.
        (settled ??= new WeakSet()).add(view);
        inEvent = false;
        flush();
      } else hold(event, view, onError);
    }
    inEvent = false;
  }
}
// `hold` posts the flush through a MessageChannel (no timer clamping, before rAF).
