// Scoped themes on the cdk overlay layer: a portaled overlay (Popover, Select, Modal, Tooltip, Toast, …) leaves the
// subtree that carries `data-ui-theme="rivet"` (`styles/themes/scoped.css`) / `data-ui-preset` (`themes/presets.css`) /
// a forced mode (`data-theme`, `.dark`), so its tokens would be empty. cdk `portalHooks.place` runs right after a
// `<Portal>` host moved from its in-place parent (the trigger's subtree): the host gets each scope attribute of its
// old position that does not already apply at the new one (the scope does not contain the mount). Nested overlays
// start inside a stamped host, so they inherit it; no scope → no attribute (the page theme stays the default).
// Each ui overlay module imports `portalTheme` and calls it in its body; module evaluation registers it too
// (`overlay-motion.ts` pattern): cdk alone pays one property read per move.
import { portalHooks } from "@rivetjs/cdk/portal";

const SCOPES = ["data-ui-theme", "data-ui-preset", "data-theme"];

/** Copy the theme scope attributes of `from` (in-place parent) to a moved overlay `host`. */
export function stampPortalTheme(host: HTMLElement, from: Element | null): void {
  if (!from) return;
  for (const name of SCOPES) {
    const scope = from.closest(`[${name}]`);
    if (scope && !scope.contains(host)) host.setAttribute(name, scope.getAttribute(name)!);
  }
  const dark = from.closest(".dark");
  if (dark && !dark.contains(host)) host.classList.add("dark");
}

/** Registers the theme scope stamp on the cdk overlay layer (idempotent). */
export function portalTheme(): void {
  portalHooks.place ??= stampPortalTheme;
}
// Module evaluation registers it too: a resumed page's Portal effect reads the hook through the module object.
portalTheme();
