// Disclosure on a resumed page with an animated panel (RAC docs CSS as an inline style: `height: var(--disclosure-panel-height)` + transition):
// `#d-trigger` toggles `#d-panel` (collapsed at load), `#do-trigger` toggles `#do-panel` (defaultExpanded).
import { Button } from "@rivetjs/cdk/button";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";

export const head = { title: "Disclosure" };

const PANEL_STYLE = { height: "var(--disclosure-panel-height)", overflow: "clip", transition: "height 150ms" };

export default function DisclosureStory() {
  return (
    <section>
      <Disclosure>
        <Button slot="trigger" id="d-trigger">
          Toggle
        </Button>
        <DisclosurePanel id="d-panel" style={PANEL_STYLE}>
          <p style={{ margin: 0, height: "40px" }}>Panel content</p>
        </DisclosurePanel>
      </Disclosure>
      <Disclosure defaultExpanded>
        <Button slot="trigger" id="do-trigger">
          Toggle open
        </Button>
        <DisclosurePanel id="do-panel" style={PANEL_STYLE}>
          <p style={{ margin: 0, height: "40px" }}>Open content</p>
        </DisclosurePanel>
      </Disclosure>
    </section>
  );
}
