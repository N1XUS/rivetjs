// DisclosureGroup on a resumed page: `#dg` controlled by a two-way `expandedKeys` signal (items `dg-a` / `dg-b` / `dg-c`,
// `#dg-keys` shows the keys) + `useDisclosureGroupNavigation` buttons `#dg-prev` / `#dg-next`; `#dgm` uncontrolled with
// `allowsMultipleExpanded` (items `dgm-a` / `dgm-b`).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Disclosure } from "@rivetjs/ui/disclosure";
import { DisclosureGroup, useDisclosureGroupNavigation } from "@rivetjs/ui/disclosure-group";

export default function DisclosureGroupStories() {
  const keys = signal(new Set<string | number>(["dg-a"]));
  const nav = useDisclosureGroupNavigation({ expandedKeys: keys, itemIds: ["dg-a", "dg-b", "dg-c"], onExpandedChange: (k) => keys.set(k) });
  return (
    <section class="flex w-96 flex-col gap-8 p-10">
      <span id="dg-keys">{[...keys()].join(",")}</span>
      <div class="flex gap-2">
        <Button id="dg-prev" aria-label="Previous disclosure" isDisabled={nav.isPrevDisabled} size="sm" variant="secondary" onPress={nav.onPrevious}>
          Previous
        </Button>
        <Button id="dg-next" aria-label="Next disclosure" isDisabled={nav.isNextDisabled} size="sm" variant="secondary" onPress={nav.onNext}>
          Next
        </Button>
      </div>
      <DisclosureGroup id="dg" expandedKeys={keys}>
        <Disclosure id="dg-a">
          <Disclosure.Heading>
            <Disclosure.Trigger>Item A</Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body>Content A</Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure id="dg-b">
          <Disclosure.Heading>
            <Disclosure.Trigger>Item B</Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body>Content B</Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure id="dg-c">
          <Disclosure.Heading>
            <Disclosure.Trigger>Item C</Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body>Content C</Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </DisclosureGroup>
      <DisclosureGroup id="dgm" allowsMultipleExpanded>
        <Disclosure id="dgm-a">
          <Disclosure.Heading>
            <Disclosure.Trigger>Multi A</Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body>Multi content A</Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure id="dgm-b">
          <Disclosure.Heading>
            <Disclosure.Trigger>Multi B</Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body>Multi content B</Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      </DisclosureGroup>
    </section>
  );
}
