import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel, closeAll, createDisclosureGroupState, openAll } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion: open all / close all" };

const chapters = ["Intro", "Usage", "Advanced"];

// #region demo
export default function Chapters() {
  const multi = signal(false);
  // A group state created outside the DisclosureGroup (Angular CDK accordion): openAll / closeAll from anywhere.
  const accordion = createDisclosureGroupState({ allowsMultipleExpanded: multi });
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1">
          <input id="multi" type="checkbox" checked={multi()} onChange={(event) => multi.set(event.currentTarget.checked)} /> multiple
        </label>
        <button id="open-all" type="button" class="rounded border px-2 py-1" onClick={() => openAll(accordion)}>
          Open all
        </button>
        <button id="close-all" type="button" class="rounded border px-2 py-1" onClick={() => closeAll(accordion)}>
          Close all
        </button>
      </div>
      <DisclosureGroup state={accordion} class="divide-y rounded border">
        {chapters.map((chapter, index) => (
          <Disclosure id={chapter.toLowerCase()} isDisabled={index === 2}>
            <Heading level={3} class="m-0">
              <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium disabled:opacity-50">
                {chapter}
                {index === 2 ? " (disabled)" : ""}
              </Button>
            </Heading>
            <DisclosurePanel class="px-3 pb-2 text-slate-600">{chapter} text</DisclosurePanel>
          </Disclosure>
        ))}
      </DisclosureGroup>
    </section>
  );
}
// #endregion
