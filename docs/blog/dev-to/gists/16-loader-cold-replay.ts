// libs/runtime/resume-loader.ts (excerpt) — a "cold" event: the user acted before the chunk arrived.
// Cancel the default, snapshot the target's form state, queue on a chain so events replay in
// dispatch order whatever order their chunks land in, then replay the default if the handler
// didn't prevent it. Two quick file picks each replay with their own selection. Keystrokes typed
// while chunks load arrive as keydown/beforeinput/input per key, in sequence.
if (replay) event.preventDefault();
// The target's form state at dispatch: later events' defaults (typed text, a toggle) land before this
// one replays, so the runtime shows its handlers (and bindings) the state they would have seen (a
// file input's `files` too: two quick picks replay each with its own selection).
const target = event.target as HTMLInputElement,
  live = [target.value, target.checked, target.files];
cold++;
chain = chain
  .then(() => Promise.all([boot(), ensure(chunks)]))
  .then(
    () => {
      // Events its handlers dispatch (a `focus()`'s focusin, a link's synthetic click) are nested: they run
      // now, as on a live page, not behind the cold events still queued (whose count is set aside meanwhile).
      const queued = --cold;
      cold = 0;
      const kept = run(!!replay, live);
      queueMicrotask(() => ((cold += queued), kept || (replay && replay())));
    },
    (error: unknown) => (cold--, fail(error)),
  );
