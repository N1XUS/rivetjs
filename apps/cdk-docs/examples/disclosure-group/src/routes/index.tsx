import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/disclosure";

export const head = { title: "DisclosureGroup" };

// #region demo
export default function Faq() {
  return (
    <DisclosureGroup class="m-4 grid max-w-md gap-2 text-sm" defaultExpandedKeys={["what"]}>
      <Disclosure id="what">
        <Heading level={3}>
          <Button slot="trigger">What is Rivet?</Button>
        </Heading>
        <DisclosurePanel>
          <p>A compiled, resumable UI framework.</p>
        </DisclosurePanel>
      </Disclosure>
      <Disclosure id="js">
        <Heading level={3}>
          <Button slot="trigger">Does this accordion need JavaScript?</Button>
        </Heading>
        <DisclosurePanel>
          <p>The server renders the final state; the first press loads the handler.</p>
        </DisclosurePanel>
      </Disclosure>
      <Disclosure id="find">
        <Heading level={3}>
          <Button slot="trigger">What about find-in-page?</Button>
        </Heading>
        <DisclosurePanel>
          <p>Once the page is interactive, closed panels are hidden="until-found": the browser opens one when a search matches.</p>
        </DisclosurePanel>
      </Disclosure>
    </DisclosureGroup>
  );
}
// #endregion
