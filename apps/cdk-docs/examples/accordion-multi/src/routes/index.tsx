import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion: multi" };

const filters = [
  { id: "color", title: "Color", options: "Red, Green, Blue" },
  { id: "size", title: "Size", options: "S, M, L, XL" },
  { id: "brand", title: "Brand", options: "Acme, Globex" },
];

// #region demo
export default function Filters() {
  return (
    // allowsMultipleExpanded = Angular CDK accordion `multi`.
    <DisclosureGroup allowsMultipleExpanded class="m-4 grid max-w-xs gap-2 text-sm">
      {filters.map((filter) => (
        <Disclosure id={filter.id} class="rounded border border-slate-200">
          <Heading level={3} class="m-0">
            <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium aria-expanded:bg-slate-100">
              {filter.title}
            </Button>
          </Heading>
          <DisclosurePanel class="px-3 py-2 text-slate-600">{filter.options}</DisclosurePanel>
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}
// #endregion
