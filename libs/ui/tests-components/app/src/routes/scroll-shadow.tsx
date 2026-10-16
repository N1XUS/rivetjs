// ScrollShadow on a resumed page: `#ss` (120px tall, 1000×1000 content) with live `orientation` (`#ss-orient`), `size`
// (`#ss-size` 40 ↔ 80), `hideScrollBar` (`#ss-hide`), `visibility` (`#ss-vis` cycles auto → both → none → auto) and
// `isEnabled` (`#ss-enabled`); `onVisibilityChange` → `#ss-state`. `#ss-static`: upstream Default story (short text, fits).
import { signal } from "@rivetjs/reactivity";
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";
import type { ScrollShadowVisibility } from "@rivetjs/ui/scroll-shadow";

const NEXT: Record<string, ScrollShadowVisibility> = { auto: "both", both: "none", none: "auto" };

export default function ScrollShadowStories() {
  const orientation = signal<"vertical" | "horizontal">("vertical");
  const size = signal(40);
  const hide = signal(false);
  const visibility = signal<ScrollShadowVisibility>("auto");
  const enabled = signal(true);
  const state = signal<ScrollShadowVisibility | "">("");
  return (
    <main>
      <ScrollShadow
        id="ss"
        style={{ height: "120px", width: "240px" }}
        orientation={orientation()}
        size={size()}
        hideScrollBar={hide()}
        visibility={visibility()}
        isEnabled={enabled()}
        onVisibilityChange={(v: ScrollShadowVisibility) => state.set(v)}
      >
        <div id="ss-content" style={{ height: "1000px", width: "1000px" }}>
          Tall and wide content
        </div>
      </ScrollShadow>
      <output id="ss-state">{state()}</output>
      <button id="ss-orient" type="button" onClick={() => orientation.set(orientation() === "vertical" ? "horizontal" : "vertical")}>
        orientation
      </button>
      <button id="ss-size" type="button" onClick={() => size.set(size() === 40 ? 80 : 40)}>
        size
      </button>
      <button id="ss-hide" type="button" onClick={() => hide.set(!hide())}>
        hide scrollbar
      </button>
      <button id="ss-vis" type="button" onClick={() => visibility.set(NEXT[visibility()]!)}>
        visibility
      </button>
      <button id="ss-enabled" type="button" onClick={() => enabled.set(!enabled())}>
        enabled
      </button>

      <ScrollShadow id="ss-static" class="max-h-[240px] p-4">
        <p>Short content</p>
      </ScrollShadow>
    </main>
  );
}
