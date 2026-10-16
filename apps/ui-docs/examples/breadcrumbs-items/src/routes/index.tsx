// Rivet addition (no upstream demo): Breadcrumbs from `items` data, no render function.
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export const head = { title: "Breadcrumbs: Items" };

// #region demo
export function Items() {
  return <Breadcrumbs items={[{ label: "Home", href: "#home" }, { label: "Docs", href: "#docs" }, { label: "Breadcrumbs" }]} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Items />
    </div>
  );
}
