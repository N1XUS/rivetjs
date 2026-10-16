// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/link/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Link } from "@rivetjs/ui/link";

export const head = { title: "Link: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Link
      class="font-medium text-neutral-700 underline decoration-neutral-300/80 underline-offset-4 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:decoration-neutral-600/80 dark:hover:text-neutral-100"
      href="#"
    >
      Call to action
      <Link.Icon />
    </Link>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
