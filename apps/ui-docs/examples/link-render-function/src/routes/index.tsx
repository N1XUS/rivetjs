// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/link/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Link } from "@rivetjs/ui/link";

export const head = { title: "Link: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <Link href="#" render={(props: Record<string, any>) => <span {...props} data-custom="foo" />}>
      Call to action
      <Link.Icon />
    </Link>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
