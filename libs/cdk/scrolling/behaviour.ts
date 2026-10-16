// Handlers of the scrolling components: wake the viewport engine (lazy) on the first interaction.
import type { VirtualScrollCallbacks, VirtualScrollState } from "./state.ts";
import { virtualScrollViewport } from "./virtual-scroll-viewport.ts";

/** First scroll / wheel / pointer / focus / key on (or for) a viewport: create + attach its engine. */
export function viewportInteract(state: VirtualScrollState<any>, _event?: Event, callbacks?: VirtualScrollCallbacks): void {
  virtualScrollViewport(state, undefined, callbacks);
}
