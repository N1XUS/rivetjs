import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Accordion: Tailwind" };

const questions = [
  { id: "plans", q: "Can I change plans later?", a: "Yes, upgrade or downgrade at any time." },
  { id: "trial", q: "Is there a free trial?", a: "Every plan starts with 14 days free." },
];

// #region demo
export default function Pricing() {
  return (
    <DisclosureGroup class="m-4 grid max-w-md gap-2 text-sm">
      {questions.map((question) => (
        // data-expanded is on the Disclosure root: style the whole card with group-data-expanded:
        <Disclosure
          id={question.id}
          class="group rounded-xl border border-slate-200 transition-colors data-expanded:border-indigo-300 data-expanded:bg-indigo-50/60"
        >
          <Heading level={3} class="m-0">
            <Button
              slot="trigger"
              class="flex w-full items-center justify-between gap-4 px-4 py-3 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 aria-expanded:text-indigo-800"
            >
              {question.q}
              <Icon icon={ChevronDown} class="size-4 shrink-0 transition-transform group-data-expanded:rotate-180" />
            </Button>
          </Heading>
          <DisclosurePanel class="px-4 pb-4 text-slate-600">{question.a}</DisclosurePanel>
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}
// #endregion
