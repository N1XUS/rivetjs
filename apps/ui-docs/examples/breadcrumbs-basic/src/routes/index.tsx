// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/breadcrumbs/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export const head = { title: "Breadcrumbs: Usage" };

// #region demo
export function BreadcrumbsBasic() {
  return (
    <Breadcrumbs>
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
      <BreadcrumbsBasic />
    </div>
  );
}
