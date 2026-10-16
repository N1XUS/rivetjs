import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Accordion: CSS" };

const topics = [
  { id: "install", title: "Install", body: "npm install @rivetjs/cdk" },
  { id: "import", title: "Import", body: 'import { DisclosureGroup } from "@rivetjs/cdk/accordion"' },
];

// #region demo
export default function Topics() {
  return (
    <DisclosureGroup>
      {topics.map((topic) => (
        <Disclosure id={topic.id}>
          <Heading level={3}>
            <Button slot="trigger">
              {topic.title}
              <Icon icon={ChevronDown} class="chevron" />
            </Button>
          </Heading>
          <DisclosurePanel>
            <code>{topic.body}</code>
          </DisclosurePanel>
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}
// #endregion
