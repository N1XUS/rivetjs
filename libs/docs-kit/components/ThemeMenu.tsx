import { Moon, Sun } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

export type ThemeMenuPlacement = "right bottom" | "bottom end";

/** The trigger's icons: the current theme's (CSS on `data-theme`). */
export const themeIcons = () => (
  <>
    <Icon icon={Sun} size={19} strokeWidth={1.75} class="icon-light" />
    <Icon icon={Moon} size={19} strokeWidth={1.75} class="icon-dark" />
  </>
);

/**
 * Theme menu (System / Light / Dark). The page renders only this button — no boundary, no JS before input (RT-DIET2
 * DOCS-CHROME): the docs page script (`page-script.ts`) fetches `theme-menu-open.tsx` when the pointer or focus reaches
 * it and, on activation, mounts `ThemeMenuLive` in its place, open. Same markup as the cdk `MenuTrigger` button.
 */
export function ThemeMenu({ placement = "bottom end" }: { placement?: ThemeMenuPlacement }) {
  return (
    <button
      type="button"
      class="top-icon theme-button"
      aria-label="Theme"
      aria-haspopup="true"
      aria-expanded="false"
      data-menu-placement={placement}
      data-chrome=""
    >
      {themeIcons()}
    </button>
  );
}
