import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion: DOM events" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.set([...log(), entry]);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <DisclosureGroup id="docs" lang="en-GB" class="rounded border" onPointerEnter={() => add("group pointerenter")}>
        <Disclosure
          id="colour"
          dir="ltr"
          // The trigger's press handling stops click / pointerdown propagation (RA usePress); pointerenter bubbles.
          onPointerEnter={() => add("disclosure pointerenter")}
          onDblClick={() => add("disclosure dblclick")}
          onContextMenu={(event) => {
            event.preventDefault();
            add("disclosure contextmenu");
          }}
        >
          <Heading level={3} class="m-0">
            <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium">
              Colour
            </Button>
          </Heading>
          <DisclosurePanel class="px-3 pb-2">British spelling.</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
      <output id="log">{log().join(", ") || "No events yet"}</output>
    </section>
  );
}
// #endregion
