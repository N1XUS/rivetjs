// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/breadcrumbs/custom-separator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Play } from "lucide";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export const head = { title: "Breadcrumbs: Custom Separator" };

// #region demo
export function BreadcrumbsCustomSeparator() {
  return (
    <Breadcrumbs separator={<Icon icon={Play} size={12} fill="currentColor" />}>
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
      <BreadcrumbsCustomSeparator />
    </div>
  );
}
