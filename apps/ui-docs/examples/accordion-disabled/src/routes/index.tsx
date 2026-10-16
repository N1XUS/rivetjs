// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Accordion } from "@rivetjs/ui/accordion";

export const head = { title: "Accordion: Disabled State" };

// #region demo
export function Disabled() {
  return (
    <div class="flex w-full flex-col items-center gap-8">
      <div class="w-full max-w-md space-y-2">
        <h3 class="text-sm font-medium text-muted">Entire accordion disabled</h3>
        <Accordion isDisabled class="w-full max-w-md">
          <Accordion.Item>
            <Accordion.Heading>
              <Accordion.Trigger>
                Disabled Item 1
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>This content cannot be accessed when the accordion is disabled.</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item>
            <Accordion.Heading>
              <Accordion.Trigger>
                Disabled Item 2
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>This content cannot be accessed when the accordion is disabled.</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </div>

      <div class="w-full max-w-md space-y-2">
        <h3 class="text-sm font-medium text-muted">Individual items disabled</h3>
        <Accordion class="w-full max-w-md">
          <Accordion.Item>
            <Accordion.Heading>
              <Accordion.Trigger>
                Active Item
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>This item is active and can be toggled normally.</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item isDisabled>
            <Accordion.Heading>
              <Accordion.Trigger>
                Disabled Item
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>This content cannot be accessed when the item is disabled.</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item>
            <Accordion.Heading>
              <Accordion.Trigger>
                Another Active Item
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>This item is also active and can be toggled.</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
