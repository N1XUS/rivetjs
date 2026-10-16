import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/disclosure";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Disclosure with plain CSS" };

// #region demo
export default function Faq() {
  return (
    <DisclosureGroup>
      <Disclosure id="returns">
        <Heading level={3}>
          <Button slot="trigger">
            Returns <Icon icon={ChevronDown} class="chevron" />
          </Button>
        </Heading>
        <DisclosurePanel>Return any item within 30 days.</DisclosurePanel>
      </Disclosure>
      <Disclosure id="shipping">
        <Heading level={3}>
          <Button slot="trigger">
            Shipping <Icon icon={ChevronDown} class="chevron" />
          </Button>
        </Heading>
        <DisclosurePanel>Orders ship within two business days.</DisclosurePanel>
      </Disclosure>
    </DisclosureGroup>
  );
}
// #endregion
