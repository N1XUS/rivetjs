import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion: events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.set([...log(), entry]);
  const showExtra = signal(false);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <DisclosureGroup class="divide-y rounded border">
        {/* Angular CDK accordion item events: onOpened / onClosed (also when the group closes it), onDestroyed. */}
        <Disclosure
          id="one"
          onOpened={() => add("one opened")}
          onClosed={() => add("one closed")}
          onExpandedChange={(isExpanded) => add("one expandedChange " + isExpanded)}
        >
          <Heading level={3} class="m-0">
            <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium">
              One
            </Button>
          </Heading>
          <DisclosurePanel class="px-3 pb-2 text-slate-600">One body</DisclosurePanel>
        </Disclosure>
        <Disclosure id="two" onOpened={() => add("two opened")} onClosed={() => add("two closed")}>
          <Heading level={3} class="m-0">
            <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium">
              Two
            </Button>
          </Heading>
          <DisclosurePanel class="px-3 pb-2 text-slate-600">Two body</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
      <button id="toggle-extra" type="button" class="justify-self-start rounded border px-2 py-1" onClick={() => showExtra.set(!showExtra())}>
        {showExtra() ? "Remove" : "Add"} a standalone disclosure
      </button>
      <Show when={showExtra}>
        {() => (
          <Disclosure id="extra" class="rv-Disclosure rounded border" onDestroyed={() => add("extra destroyed")}>
            <Heading level={3} class="m-0">
              <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium">
                Extra
              </Button>
            </Heading>
            <DisclosurePanel class="px-3 pb-2 text-slate-600">Extra body</DisclosurePanel>
          </Disclosure>
        )}
      </Show>
      <output id="log" class="text-slate-600">
        {log().join(", ") || "No events yet"}
      </output>
    </section>
  );
}
// #endregion
