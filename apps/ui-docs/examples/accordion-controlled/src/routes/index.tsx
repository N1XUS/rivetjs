// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { ChevronDown, ChevronUp } from "lucide";
import { Accordion } from "@rivetjs/ui/accordion";
import { Button } from "@rivetjs/ui/button";
import { useDisclosureGroupNavigation } from "@rivetjs/ui/disclosure-group";

export const head = { title: "Accordion: Controlled" };

// #region demo
const items = [
  {
    content: "Learn the basics of Rivet UI and how to integrate it into your Rivet app. This section covers installation, setup, and your first component.",
    id: "getting-started",
    title: "Getting Started",
  },
  {
    content:
      "Understand the fundamental concepts behind Rivet UI, including the compound component pattern, styling with Tailwind CSS, and accessibility features.",
    id: "core-concepts",
    title: "Core Concepts",
  },
  {
    content: "Explore advanced features like custom variants, theme customization, and integration with other libraries in your React ecosystem.",
    id: "advanced-usage",
    title: "Advanced Usage",
  },
];

export function Controlled() {
  // Rivet: a two-way signal replaces `useState` + `onExpandedChange={setExpandedKeys}`.
  const expandedKeys = signal(new Set<string | number>(["getting-started"]));
  const itemIds = items.map((item) => item.id);

  const { isNextDisabled, isPrevDisabled, onNext, onPrevious } = useDisclosureGroupNavigation({
    expandedKeys,
    itemIds,
    onExpandedChange: (keys) => expandedKeys.set(keys),
  });

  return (
    <div class="w-full max-w-md">
      <div class="mb-4 flex items-center justify-between">
        <p class="text-sm text-muted">
          Expanded: <strong>{[...expandedKeys()].join(", ") || "none"}</strong>
        </p>
        <div class="flex gap-2">
          <Button aria-label="Previous item" isDisabled={isPrevDisabled} size="sm" variant="secondary" onPress={onPrevious}>
            <Icon class="size-4" icon={ChevronUp} />
          </Button>
          <Button aria-label="Next item" isDisabled={isNextDisabled} size="sm" variant="secondary" onPress={onNext}>
            <Icon class="size-4" icon={ChevronDown} />
          </Button>
        </div>
      </div>
      <Accordion expandedKeys={expandedKeys}>
        {items.map((item) => (
          <Accordion.Item id={item.id}>
            <Accordion.Heading>
              <Accordion.Trigger>
                {item.title}
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>{item.content}</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
