// @rivetjs/runtime, libs/runtime/dom-resume.ts (excerpt): replaying a cold press once its handler chunks loaded.
// The browser already moved focus at dispatch; put it back to where it was (walking past presses a handler
// canceled meanwhile), replay the handlers, then let the default focus follow unless one canceled it.
const type = event.type,
  press = (type === "mousedown" || (type === "pointerdown" && (event as PointerEvent).pointerType !== "touch")) && pressTarget(event),
  pair = linked.has(event);
if (press && !(pair && type === "mousedown") && doc.activeElement === (press[0] ?? doc.body)) {
  let was = live[3] as HTMLElement | null,
    ts = event.timeStamp,
    u: [Element | null, number, number] | undefined;
  while (was && (u = undone.get(was)?.findLast((e) => e[2] < ts && event.timeStamp < e[1]))) ((was = u[0] as HTMLElement | null), (ts = u[2]));
  was && was !== doc.body ? was.focus({ preventScroll: true }) : press[0]?.blur();
}
const kept = deliver(this, event, hit[0], !!replay || !!press, live);
queueMicrotask(() => {
  held += queued;
  // An unpaired pointerdown's default focus follows even when canceled (only a canceled mousedown keeps
  // focus where it was).
  if (press && !(pair && type === "pointerdown"))
    if (!kept || type === "pointerdown")
      press[0] ? press[0].focus({ preventScroll: true, focusVisible: false } as FocusOptions) : (doc.activeElement as HTMLElement | null)?.blur?.();
    else if (press[0]) {
      const list = undone.get(press[0]) ?? [];
      (undone.set(press[0], list), list.push([live[3] as Element | null, performance.now(), event.timeStamp]));
    }
  kept || (replay && replay());
});
