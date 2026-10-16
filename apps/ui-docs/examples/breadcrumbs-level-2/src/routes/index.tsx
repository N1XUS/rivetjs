// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/breadcrumbs/level-2.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export const head = { title: "Breadcrumbs: Navigation Levels" };

// #region demo
export function BreadcrumbsLevel2() {
  return (
    <Breadcrumbs>
      <Breadcrumbs.Item href="#">Home</Breadcrumbs.Item>
      <Breadcrumbs.Item>Current Page</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BreadcrumbsLevel2 />
    </div>
  );
}
