// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/accordion/multiple.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Accordion } from "@rivetjs/ui/accordion";

export const head = { title: "Accordion: Multiple Expanded" };

// #region demo
export function Multiple() {
  return (
    <Accordion allowsMultipleExpanded class="w-full max-w-md">
      <Accordion.Item>
        <Accordion.Heading>
          <Accordion.Trigger>
            Getting Started
            <Accordion.Indicator />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>
            Learn the basics of Rivet UI and how to integrate it into your Rivet app. This section covers installation, setup, and your first component.
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item>
        <Accordion.Heading>
          <Accordion.Trigger>
            Core Concepts
            <Accordion.Indicator />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>
            Understand the fundamental concepts behind Rivet UI, including the compound component pattern, styling with Tailwind CSS, and accessibility
            features.
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item>
        <Accordion.Heading>
          <Accordion.Trigger>
            Advanced Usage
            <Accordion.Indicator />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>
            Explore advanced features like custom variants, theme customization, and integration with other libraries in your React ecosystem.
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item>
        <Accordion.Heading>
          <Accordion.Trigger>
            Best Practices
            <Accordion.Indicator />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>
            Follow our recommended best practices for building performant, accessible, and maintainable applications with Rivet UI components.
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Multiple />
    </div>
  );
}
