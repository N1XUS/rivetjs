import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion: disabled" };

const steps = [
  { id: "account", title: "Account", isDisabled: false },
  { id: "billing", title: "Billing (disabled)", isDisabled: true },
  { id: "review", title: "Review", isDisabled: false },
];

// #region demo
export default function Steps() {
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <DisclosureGroup class="divide-y rounded border">
        {steps.map((step) => (
          // A disabled Disclosure: its trigger is disabled; openAll / closeAll leave it as it is.
          <Disclosure id={step.id} isDisabled={step.isDisabled}>
            <Heading level={3} class="m-0">
              <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium disabled:cursor-not-allowed disabled:opacity-50">
                {step.title}
              </Button>
            </Heading>
            <DisclosurePanel class="px-3 pb-2 text-slate-600">{step.title} details</DisclosurePanel>
          </Disclosure>
        ))}
      </DisclosureGroup>
      {/* isDisabled on the group disables every disclosure in it. */}
      <DisclosureGroup id="all-disabled" isDisabled class="rounded border">
        <Disclosure id="locked">
          <Heading level={3} class="m-0">
            <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium disabled:opacity-50">
              Locked group
            </Button>
          </Heading>
          <DisclosurePanel class="px-3 pb-2">Never shown.</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </section>
  );
}
// #endregion
