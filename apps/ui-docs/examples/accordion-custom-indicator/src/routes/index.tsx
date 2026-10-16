// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/custom-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronsDown, CircleChevronDown, Minus, Plus } from "lucide";
import { Accordion } from "@rivetjs/ui/accordion";

export const head = { title: "Accordion: Custom Indicator" };

// #region demo
export function CustomIndicator() {
  // Rivet: a two-way signal replaces `useState` + `onExpandedChange={setExpandedKeys}`.
  const expandedKeys = signal(new Set<string | number>([""]));

  return (
    <Accordion class="w-full max-w-md" expandedKeys={expandedKeys} variant="surface">
      <Accordion.Item id="1">
        <Accordion.Heading>
          <Accordion.Trigger>
            Using Plus/Minus Icon
            <Accordion.Indicator>{expandedKeys().has("1") ? <Icon icon={Minus} /> : <Icon icon={Plus} />}</Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>
            This accordion uses a plus icon that transforms when expanded. The icon automatically rotates 45 degrees to form an X.
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item id="2">
        <Accordion.Heading>
          <Accordion.Trigger>
            Using Caret Icon
            <Accordion.Indicator>
              <Icon icon={CircleChevronDown} />
            </Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>This item uses a caret icon for the indicator. The rotation animation is applied automatically.</Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item id="3">
        <Accordion.Heading>
          <Accordion.Trigger>
            Using Arrow Icon
            <Accordion.Indicator>
              <Icon icon={ChevronsDown} />
            </Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>This item uses an arrow icon. Any icon you pass will receive the rotation animation when the item expands.</Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomIndicator />
    </div>
  );
}
