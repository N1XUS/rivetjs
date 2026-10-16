// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/link/icon-placement.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Link } from "@rivetjs/ui/link";

export const head = { title: "Link: Icon Placement" };

// #region demo
export function LinkIconPlacement() {
  return (
    <div class="flex flex-col gap-3">
      <Link href="#">
        Icon at end (default)
        <Link.Icon />
      </Link>
      <Link class="gap-1" href="#">
        <Link.Icon />
        Icon at start
      </Link>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <LinkIconPlacement />
    </div>
  );
}
