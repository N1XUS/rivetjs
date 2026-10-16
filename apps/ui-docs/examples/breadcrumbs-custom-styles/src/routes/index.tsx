// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/breadcrumbs/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export const head = { title: "Breadcrumbs: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Breadcrumbs class="rounded-lg bg-default-soft px-3 py-2">
      <Breadcrumbs.Item class="text-muted hover:text-accent" href="#">
        Home
      </Breadcrumbs.Item>
      <Breadcrumbs.Item class="text-muted hover:text-accent" href="#">
        Products
      </Breadcrumbs.Item>
      <Breadcrumbs.Item class="font-medium text-foreground">Laptop</Breadcrumbs.Item>
    </Breadcrumbs>
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
