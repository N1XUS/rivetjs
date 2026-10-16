import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosurePanel } from "@rivetjs/cdk/disclosure";

export const head = { title: "Disclosure DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.set([...log(), entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Disclosure
        id="colour"
        lang="en-GB"
        dir="ltr"
        onPointerEnter={() => add("pointerenter")}
        onDblClick={() => add("dblclick")}
        onContextMenu={(event) => {
          event.preventDefault();
          add("contextmenu");
        }}
        onExpandedChange={(isExpanded) => add("expanded: " + isExpanded)}
      >
        <Heading level={3}>
          <Button slot="trigger">Colour</Button>
        </Heading>
        <DisclosurePanel>British spelling.</DisclosurePanel>
      </Disclosure>
      <output id="log">{log().join(", ") || "No events yet"}</output>
    </section>
  );
}
// #endregion
