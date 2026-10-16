import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";

export const head = { title: "Standalone disclosures" };

// #region demo
export default function Details() {
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      {/* No DisclosureGroup: each disclosure opens and closes on its own. */}
      <Disclosure id="specs" defaultExpanded>
        <Heading level={3}>
          <Button slot="trigger">Specifications</Button>
        </Heading>
        <DisclosurePanel>
          <p>Weight 1.2 kg, battery 12 h.</p>
        </DisclosurePanel>
      </Disclosure>
      <Disclosure id="box">
        <Heading level={3}>
          <Button slot="trigger">In the box</Button>
        </Heading>
        <DisclosurePanel>
          <p>Laptop, charger, cable.</p>
        </DisclosurePanel>
      </Disclosure>
    </section>
  );
}
// #endregion
