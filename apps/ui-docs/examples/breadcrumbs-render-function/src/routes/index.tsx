// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/breadcrumbs/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export const head = { title: "Breadcrumbs: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <Breadcrumbs render={(props) => <ol {...props} data-custom="foo" />}>
      <Breadcrumbs.Item render={(props) => <li {...(props as any)} data-custom="bar" />}>Home</Breadcrumbs.Item>
      <Breadcrumbs.Item render={(props) => <li {...(props as any)} data-custom="bar" />}>Products</Breadcrumbs.Item>
      <Breadcrumbs.Item render={(props) => <li {...(props as any)} data-custom="bar" />}>Electronics</Breadcrumbs.Item>
      <Breadcrumbs.Item render={(props) => <li {...(props as any)} data-custom="bar" />}>Laptop</Breadcrumbs.Item>
    </Breadcrumbs>
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
