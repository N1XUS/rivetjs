import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/disclosure";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Disclosure with Tailwind" };

const item = "group rounded-xl border border-slate-200 data-expanded:border-indigo-300 data-expanded:bg-indigo-50/60";
const trigger = "flex w-full items-center justify-between px-4 py-3 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

// #region demo
export default function Faq() {
  return (
    <DisclosureGroup class="m-4 grid max-w-md gap-2 text-sm">
      <Disclosure id="billing" class={item}>
        <Heading level={3}>
          <Button slot="trigger" class={trigger}>
            When am I billed? <Icon icon={ChevronDown} class="size-4 transition-transform group-data-expanded:rotate-180" />
          </Button>
        </Heading>
        <DisclosurePanel class="px-4 pb-4 text-slate-600">On the first of every month.</DisclosurePanel>
      </Disclosure>
      <Disclosure id="cancel" class={item}>
        <Heading level={3}>
          <Button slot="trigger" class={trigger}>
            Can I cancel? <Icon icon={ChevronDown} class="size-4 transition-transform group-data-expanded:rotate-180" />
          </Button>
        </Heading>
        <DisclosurePanel class="px-4 pb-4 text-slate-600">Any time, from the account page.</DisclosurePanel>
      </Disclosure>
    </DisclosureGroup>
  );
}
// #endregion
