// libs/runtime/resume-loader.ts (excerpt) — the inline script every resumable page ships (~2.2 KB brotli).
// Before interaction it parses two attributes and adds capture listeners. Then:
//   pointerover (60 ms dwell) / focusin / touchstart  → intent: boot the runtime, modulepreload the handler's
//                                                        chunk AND the chunks of every binding it can update
//   pointerdown / keydown                             → evaluate those modules
//   click                                             → handler runs synchronously; DOM update is sync too
const prefetch = (hit: Hit, event?: Event): void => {
  if (hit[3]) return;
  hit[3] = 1;
  // Intent boots the runtime (chunks stay prefetch-only until pointerdown / keydown). On a lazy router page
  // (`n`) the runtime then attaches the router's listeners and replays the intent (`api.i`) to them.
  ((api.i = event), boot().catch(fail));
  for (const i of hit[1].concat(hit[2])) if (!state.x?.includes(i)) hint(state.c[i]!);
  for (const i of hit[1].concat(hit[2])) for (const url of state.l?.[i] || []) later(url);
};
const intent = (event: Event): void => {
  const hit = find(event);
  if (hit) prefetch(hit, event);
};
const evaluate = (event: Event): void => {
  const hit = find(event);
  if (hit && !(rt && hit[1].concat(hit[2]).every((i) => done[i]))) {
    prefetch(hit);
    Promise.all([boot(), ensure(hit[1].concat(hit[2]))]).catch(fail);
  }
};

listen("pointerover", (event) => {
  clearTimeout(dwell);
  const hit = find(event);
  if (hit) dwell = setTimeout(prefetch, 60, hit, event);
});
listen("pointerout", () => clearTimeout(dwell));
listen("scroll", () => (scrolled = performance.now()));
listen("focusin", intent);
listen("touchstart", intent);
listen("pointerdown", evaluate);
listen("keydown", evaluate);
