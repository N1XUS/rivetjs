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
 * press itself loads nothing. The shortcuts and that warm-up are plain document listeners of the docs page script
 * (`page-script.ts`, ZERO Z13): no client trigger (they booted the resume runtime at idle), and no delegated handler
 * run on a mere hover (the loader would prefetch the shell chunk's intent sibling, ~85 KB br).
 */
export function SearchButton({ variant = "bar", shortcuts = true }: { variant?: "bar" | "icon"; shortcuts?: boolean }) {
  // Shortcuts (`/`, Ctrl/Cmd+K) and the dialog warm-up are the docs page script's (`page-script.ts`, ZERO Z13): document
  // listeners here were client triggers that booted the resume runtime at idle on every page. `shortcuts` = the hint.
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
