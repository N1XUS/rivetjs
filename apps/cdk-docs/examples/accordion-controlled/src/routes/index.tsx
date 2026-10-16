import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Disclosure, DisclosureGroup, DisclosurePanel, type Key } from "@rivetjs/cdk/accordion";

export const head = { title: "Accordion: controlled" };

// #region demo
export default function Settings() {
  // Two-way signal: the group writes it on toggle, and you can read or set it.
  const expandedKeys = signal<Set<Key>>(new Set(["profile"]));
  // A standalone Disclosure controlled by its own signal.
  const notesOpen = signal(false);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <div class="flex flex-wrap gap-2">
        <button id="open-privacy" type="button" class="rounded border px-2 py-1" onClick={() => expandedKeys.set(new Set(["privacy"]))}>
          Open privacy
        </button>
        <button id="close-all" type="button" class="rounded border px-2 py-1" onClick={() => expandedKeys.set(new Set())}>
          Close all
        </button>
        <button id="toggle-notes" type="button" class="rounded border px-2 py-1" onClick={() => notesOpen.set(!notesOpen())}>
          Toggle notes
        </button>
      </div>
      <DisclosureGroup expandedKeys={expandedKeys} class="divide-y rounded border">
        <Disclosure id="privacy">
          <Heading level={3} class="m-0">
            <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium aria-expanded:text-indigo-700">
              Privacy
            </Button>
          </Heading>
          <DisclosurePanel class="px-3 pb-2 text-slate-600">Privacy settings</DisclosurePanel>
        </Disclosure>
        <Disclosure id="profile">
          <Heading level={3} class="m-0">
            <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium aria-expanded:text-indigo-700">
              Profile
            </Button>
          </Heading>
          <DisclosurePanel class="px-3 pb-2 text-slate-600">Profile settings</DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
      <Disclosure id="notes" isExpanded={notesOpen} class="rv-Disclosure rounded border">
        <Heading level={3} class="m-0">
          <Button slot="trigger" class="w-full px-3 py-2 text-left font-medium">
            Notes
          </Button>
        </Heading>
        <DisclosurePanel class="px-3 pb-2 text-slate-600">Release notes</DisclosurePanel>
      </Disclosure>
      <output id="value">
        expanded: {[...expandedKeys()].join(", ") || "none"}; notes: {String(notesOpen())}
      </output>
    </section>
  );
}
// #endregion
