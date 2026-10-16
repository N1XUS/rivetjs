import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel, closeAll, createDisclosureGroupState, openAll } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion" };

const sections = ["One", "Two", "Three"];

// Angular CDK accordion extras on the RAC Disclosure parts: Signal `allowsMultipleExpanded` (Angular `multi`),
// an external group state for openAll / closeAll, onOpened / onClosed, a disabled item.
export default function AccordionStory() {
  const multi = signal(false);
  const accordion = createDisclosureGroupState({ allowsMultipleExpanded: multi });
  const log = signal<string[]>([]);
  return (
    <section>
      <label>
        <input id="multi" type="checkbox" checked={multi()} onChange={(event) => multi.set((event.currentTarget as HTMLInputElement).checked)} /> Multi
      </label>
      <button id="open-all" type="button" onClick={() => openAll(accordion)}>
        Open all
      </button>
      <button id="close-all" type="button" onClick={() => closeAll(accordion)}>
        Close all
      </button>
      <DisclosureGroup state={accordion} class="accordion">
        {() =>
          sections.map((name, index) => (
            <Disclosure
              id={"item-" + name.toLowerCase()}
              class={"item-" + name.toLowerCase()}
              isDisabled={index === 2}
              onOpened={() => log.set([...log(), name + " opened"])}
              onClosed={() => log.set([...log(), name + " closed"])}
            >
              <Heading level={3}>
                <Button slot="trigger">{name}</Button>
              </Heading>
              <DisclosurePanel>Content {name}</DisclosurePanel>
            </Disclosure>
          ))
        }
      </DisclosureGroup>
      <p id="log">{log().join(", ")}</p>
    </section>
  );
}
