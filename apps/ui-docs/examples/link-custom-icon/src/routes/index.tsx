// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/link/custom-icon.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { SquareArrowOutUpRight, Link as LinkIcon } from "lucide";
import { Link } from "@rivetjs/ui/link";

export const head = { title: "Link: Custom Icon" };

// #region demo
export function LinkCustomIcon() {
  return (
    <div class="flex flex-col gap-3">
      <Link href="#">
        External link
        <Link.Icon class="ms-1.5 size-3">
          <Icon icon={SquareArrowOutUpRight} size={16} />
        </Link.Icon>
      </Link>
      <Link class="gap-1" href="#">
        Go to page
        <Link.Icon class="size-3">
          <Icon icon={LinkIcon} size={16} />
        </Link.Icon>
      </Link>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <LinkCustomIcon />
    </div>
  );
}
