import { clientEvent } from "@rivetjs/runtime/dom";
import { Search } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

/**
 * Search trigger. Without JavaScript it is a link to the search page; with it, a dialog whose code
 * and index load on first use. `bar` (top bar, ≥ 900px) shows a "Search" field look with the `/`
 * key and registers the shortcuts `/` and Ctrl/Cmd+K (one listener per page, capture phase: cdk
 * buttons stop the propagation of keys pressed on them); `icon` (narrow top bar) is icon-only and
 * registers none.
 */
export function SearchButton({ variant = "bar", shortcuts = true }: { variant?: "bar" | "icon"; shortcuts?: boolean }) {
  // `shortcuts: false` (lean pages): no document listener, so nothing boots before the first interaction.
  if (variant === "bar" && shortcuts)
    clientEvent(
      document,
      "keydown",
      (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        const typing = target?.closest("input, textarea, select, [contenteditable='true']");
        if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
          event.preventDefault();
          void import("../search/dialog.tsx").then((module) => module.openSearch());
        }
      },
      { capture: true },
    );
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
