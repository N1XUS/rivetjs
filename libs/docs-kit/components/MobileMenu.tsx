import { Menu } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

/**
 * Mobile navigation button. The page renders only this button — no boundary, no JS before input (RT-DIET2
 * DOCS-CHROME): the docs page script (`page-script.ts`) fetches `mobile-menu-open.tsx` when the pointer or focus
 * reaches it and, on activation, mounts the live drawer trigger in its place with the drawer open (cdk Modal on the div
 * overlay layer: focus trap, Escape, outside press, scroll lock, focus restore). Same markup as the cdk `DialogTrigger`
 * button.
 */
export function MobileMenu() {
  return (
    <button type="button" class="top-icon menu-button" aria-label="Open navigation" aria-expanded="false" data-chrome="">
      <Icon icon={Menu} size={22} />
    </button>
  );
}
