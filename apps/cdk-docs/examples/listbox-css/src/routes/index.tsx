import { signal } from "@rivetjs/reactivity";
import { Header } from "@rivetjs/cdk/header";
import { ListBox, ListBoxItem, ListBoxSection, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "ListBox with plain CSS" };

// #region demo
export default function Plans() {
  const plan = signal<Selection>(new Set<Key>(["free"]));
  return (
    <>
      <ListBox id="plans" aria-label="Plan" selectionMode="single" selectedKeys={plan}>
        <ListBoxSection>
          <Header>Plans</Header>
          <ListBoxItem id="free" textValue="Free">
            <Text slot="label">Free</Text>
            <Text slot="description">1 project</Text>
          </ListBoxItem>
          <ListBoxItem id="pro" textValue="Pro">
            <Text slot="label">Pro</Text>
            <Text slot="description">Unlimited projects</Text>
          </ListBoxItem>
          <ListBoxItem id="team" textValue="Team" isDisabled>
            <Text slot="label">Team</Text>
            <Text slot="description">Contact sales</Text>
          </ListBoxItem>
        </ListBoxSection>
      </ListBox>
      <p id="plan-value" style={{ margin: "0 1rem" }}>
        Plan: {[...(plan() as Set<Key>)].join(", ")}
      </p>
    </>
  );
}
// #endregion
