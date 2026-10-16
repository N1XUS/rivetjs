// Accordion on a resumed page: `#acc` default (items `faq-1` / `faq-2` / disabled `faq-3`, `#acc-keys` shows the
// `onExpandedChange` keys); upstream browser-test fixtures `#acc-hover-default` / `#acc-hover-surface` (trigger
// `transition-none`) and `#acc-custom` (surface, trigger `transition-none hover:bg-surface`) + `#surface-probe` (`bg-surface`).
import { signal } from "@rivetjs/reactivity";
import { Accordion } from "@rivetjs/ui/accordion";

export default function AccordionStories() {
  const keys = signal("none");
  return (
    <section class="flex w-96 flex-col gap-8 p-10">
      <span id="acc-keys">{keys()}</span>
      <Accordion id="acc" onExpandedChange={(k: Set<string | number>) => keys.set([...k].join(","))}>
        <Accordion.Item id="faq-1">
          <Accordion.Heading>
            <Accordion.Trigger>
              How do I place an order?
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>Browse our products and proceed to checkout.</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item id="faq-2">
          <Accordion.Heading>
            <Accordion.Trigger>
              Can I modify my order?
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>Yes, before it ships.</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item isDisabled id="faq-3">
          <Accordion.Heading>
            <Accordion.Trigger>
              Disabled question
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>Never shown.</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Accordion id="acc-hover-default">
        <Accordion.Item id="n1">
          <Accordion.Heading>
            <Accordion.Trigger class="transition-none">
              Set up notifications
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>Receive account activity updates.</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Accordion id="acc-hover-surface" variant="surface">
        <Accordion.Item id="n2">
          <Accordion.Heading>
            <Accordion.Trigger class="transition-none">
              Set up notifications
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>Receive account activity updates.</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Accordion id="acc-custom" variant="surface">
        <Accordion.Item id="n3">
          <Accordion.Heading>
            <Accordion.Trigger class="transition-none hover:bg-surface">
              Set up notifications
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>Receive account activity updates.</Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <div class="bg-surface h-2" id="surface-probe" />
    </section>
  );
}
