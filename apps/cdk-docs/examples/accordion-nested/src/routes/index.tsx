import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion: nested" };

const trigger = "w-full px-3 py-2 text-left font-medium aria-expanded:text-indigo-700";

// #region demo
export default function Nested() {
  return (
    <DisclosureGroup class="m-4 max-w-sm divide-y rounded border text-sm">
      <Disclosure id="fruit">
        <Heading level={3} class="m-0">
          <Button slot="trigger" class={trigger}>
            Fruit
          </Button>
        </Heading>
        <DisclosurePanel class="pb-2 pl-4 text-slate-600">
          {/* An inner group: its disclosures belong to it, not to the outer one. */}
          <DisclosureGroup>
            <Disclosure id="apple">
              <Heading level={4} class="m-0">
                <Button slot="trigger" class={trigger}>
                  Apple
                </Button>
              </Heading>
              <DisclosurePanel class="pb-2 pl-4">Crisp.</DisclosurePanel>
            </Disclosure>
            <Disclosure id="pear">
              <Heading level={4} class="m-0">
                <Button slot="trigger" class={trigger}>
                  Pear
                </Button>
              </Heading>
              <DisclosurePanel class="pb-2 pl-4">Juicy.</DisclosurePanel>
            </Disclosure>
          </DisclosureGroup>
        </DisclosurePanel>
      </Disclosure>
      <Disclosure id="veg">
        <Heading level={3} class="m-0">
          <Button slot="trigger" class={trigger}>
            Vegetables
          </Button>
        </Heading>
        <DisclosurePanel class="pb-2 pl-4 text-slate-600">Carrot, leek.</DisclosurePanel>
      </Disclosure>
    </DisclosureGroup>
  );
}
// #endregion
