// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/breadcrumbs/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export const head = { title: "Breadcrumbs: Disabled State" };

// #region demo
export function BreadcrumbsDisabled() {
  return (
    <Breadcrumbs isDisabled>
      <Breadcrumbs.Item href="#">Home</Breadcrumbs.Item>
      <Breadcrumbs.Item href="#">Products</Breadcrumbs.Item>
      <Breadcrumbs.Item href="#">Electronics</Breadcrumbs.Item>
      <Breadcrumbs.Item>Laptop</Breadcrumbs.Item>
    </Breadcrumbs>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <BreadcrumbsDisabled />
    </div>
  );
}
