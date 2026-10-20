import { clientEvent } from "@rivetjs/runtime/dom";
import { Search } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

/**
 * Search trigger. Without JavaScript it is a link to the search page; with it, a dialog whose code
 * and index load on first use. `bar` (top bar, ≥ 900px) shows a "Search" field look with the `/`
 * key and registers the shortcuts `/` and Ctrl/Cmd+K (one listener per page, capture phase: cdk
 * buttons stop the propagation of keys pressed on them); `icon` (narrow top bar) is icon-only and
 * registers none.
 *
 * The dialog chunk (palette + light cdk overlay primitives) is fetched ahead of the press (CHUNK-CYCLE 2026-10-20):
 * on a pointer over / focus of either trigger and on a lone Ctrl / Meta keydown (the shortcut's first key), so the
 * press itself loads nothing. `import()` of a library module is never a chunk lazy the loader prefetches (only app
 * modules' are), hence the explicit warm-up. Document listeners (`clientEvent` with `match`), not handlers on the
 * link: a delegated handler run counts as an interaction with the shell chunk, and the loader then prefetches its
 * intent sibling (`resume-route_main-intent`: the frame menus + cdk collections, ~85 KB br) on a mere hover.
 */
export function SearchButton({ variant = "bar", shortcuts = true }: { variant?: "bar" | "icon"; shortcuts?: boolean }) {
  // `shortcuts: false` (lean pages): no document listener, so nothing boots before the first interaction.
  if (variant === "bar" && shortcuts)
    clientEvent(
      document,
      "keydown",
      (event: KeyboardEvent) => {
        // Ctrl / Meta down: Ctrl+K / Cmd+K follows — fetch the dialog while the second key is on its way.
        if (event.key === "Control" || event.key === "Meta") return void import("../search/dialog.tsx");
        const target = event.target as HTMLElement | null;
        const typing = target?.closest("input, textarea, select, [contenteditable='true']");
        if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
          event.preventDefault();
          void import("../search/dialog.tsx").then((module) => module.openSearch());
        }
      },
      { capture: true },
    );
  if (variant === "bar" && shortcuts) {
    clientEvent(document, "pointerover", () => void import("../search/dialog.tsx"), { match: ".search-button", once: true });
    clientEvent(document, "focusin", () => void import("../search/dialog.tsx"), { match: ".search-button", once: true });
  }
  return (
    <a
      class={"search-button search-button-" + variant}
      href="/search/"
      data-rivet-reload=""
      aria-label="Search"
      aria-keyshortcuts={variant === "bar" && shortcuts ? "/ Control+K Meta+K" : undefined}
      onClick={(event) => {
        event.preventDefault();
        void import("../search/dialog.tsx").then((module) => module.openSearch());
      }}
    >
      <Icon icon={Search} size={variant === "bar" ? 16 : 20} strokeWidth={1.75} />
      {variant === "bar" ? (
        <>
          <span class="search-label" aria-hidden="true">
            Search
          </span>
          {shortcuts ? (
            <kbd class="search-key" aria-hidden="true">
              /
            </kbd>
          ) : null}
        </>
      ) : null}
    </a>
  );
}
