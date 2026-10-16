import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";
import { Minus, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Accordion" };

const sections = [
  { id: "shipping", title: "Shipping", body: "Orders ship within two business days." },
  { id: "returns", title: "Returns", body: "Return any item within 30 days." },
  { id: "warranty", title: "Warranty", body: "Every product has a two-year warranty." },
];

// #region demo
export default function Faq() {
  return (
    <DisclosureGroup defaultExpandedKeys={["shipping"]} class="m-4 max-w-md divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm">
      {sections.map((section) => (
        <Disclosure id={section.id}>
          {({ isExpanded }) => (
            <>
              <Heading level={3} class="m-0">
                <Button
                  slot="trigger"
                  class="flex w-full items-center justify-between px-4 py-3 text-left font-medium hover:bg-slate-50 aria-expanded:text-indigo-700"
                >
                  {section.title}
                  {isExpanded() ? <Icon icon={Minus} class="minus" /> : <Icon icon={Plus} class="plus" />}
                </Button>
              </Heading>
              <DisclosurePanel class="px-4 pb-3 text-slate-600">{section.body}</DisclosurePanel>
            </>
          )}
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}
// #endregion
