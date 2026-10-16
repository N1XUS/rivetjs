// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/link/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Link } from "@rivetjs/ui/link";

export const head = { title: "Link: Usage" };

// #region demo
export function LinkBasic() {
  return (
    <Link href="#">
      Call to action
      <Link.Icon />
    </Link>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <LinkBasic />
    </div>
  );
}
