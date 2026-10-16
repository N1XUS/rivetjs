// Type-level checks for `@rivetjs/ui/accordion` (tsc only, not run).
import { signal } from "@rivetjs/reactivity";
import { Accordion, AccordionRoot } from "../src/components/accordion/index.ts";
import type { AccordionProps } from "../src/components/accordion/index.ts";

const keys = signal(new Set<string | number>(["a"]));

export const a = (
  <Accordion allowsMultipleExpanded expandedKeys={keys} hideSeparator variant="surface" class="x" onExpandedChange={(k) => k.size}>
    <Accordion.Item id="a" isDisabled>
      <Accordion.Heading>
        <Accordion.Trigger class={({ isPressed }) => (isPressed() ? "p" : "")}>
          A
          <Accordion.Indicator class="i" />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body class="b">Body</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion>
);
export const b = <AccordionRoot defaultExpandedKeys={["a"]} />;
export const c: AccordionProps = { variant: "default" };
// @ts-expect-error unknown variant
export const d = <Accordion variant="loud" />;
