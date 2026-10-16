// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/disclosure-group/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Disclosure } from "@rivetjs/ui/disclosure";
import { DisclosureGroup } from "@rivetjs/ui/disclosure-group";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "DisclosureGroup: Custom Styles" };

// #region demo
export function CustomStyles() {
  return (
    <DisclosureGroup class="w-full max-w-sm rounded-xl bg-default-soft p-2">
      <Disclosure id="billing">
        <Disclosure.Heading>
          <Button class="w-full justify-between" slot="trigger" variant="ghost">
            Billing
            <Disclosure.Indicator class="text-muted" />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body class="text-sm text-muted">Invoices are issued on the first of each month.</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
      <Separator class="my-1" />
      <Disclosure id="support">
        <Disclosure.Heading>
          <Button class="w-full justify-between" slot="trigger" variant="ghost">
            Support
            <Disclosure.Indicator class="text-muted" />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body class="text-sm text-muted">Reach us at help@acme.com. Typical response time is under one business day.</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </DisclosureGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
