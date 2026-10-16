// Disclosure on a resumed page (upstream disclosure fixture): `#ds` collapsed (`#ds-trigger`, `#ds-panel`, `#ds-indicator`);
// `#ds-open` defaultExpanded (`#dso-trigger`, `#dso-panel`); `#ds-state` shows the last `onExpandedChange` value.
import { signal } from "@rivetjs/reactivity";
import { Disclosure } from "@rivetjs/ui/disclosure";

export default function DisclosureStories() {
  const last = signal("none");
  return (
    <section class="flex w-96 flex-col gap-8 p-10">
      <span id="ds-state">{last()}</span>
      <Disclosure id="ds" onExpandedChange={(e: boolean) => last.set(String(e))}>
        <Disclosure.Heading>
          <Disclosure.Trigger id="ds-trigger">
            Toggle content
            <Disclosure.Indicator id="ds-indicator" />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content id="ds-panel">
          <Disclosure.Body>Hidden content revealed on expand.</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
      <Disclosure id="ds-open" defaultExpanded>
        <Disclosure.Heading>
          <Disclosure.Trigger id="dso-trigger">
            Open by default
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content id="dso-panel">
          <Disclosure.Body>Visible on load.</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </section>
  );
}
