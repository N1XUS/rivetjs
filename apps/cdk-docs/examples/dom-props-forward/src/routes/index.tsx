import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Tab, TabList, TabPanel, Tabs } from "@rivetjs/cdk/tabs";

export const head = { title: "Forwarding DOM events and attributes" };

// #region demo
export default function Forwarding() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-7), entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      {/* Root element: the <button>. */}
      <Button
        id="save"
        lang="en-GB"
        dir="ltr"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onPointerEnter={() => add("save:enter")}
        onDblClick={() => add("save:dblclick")}
        onContextMenu={(e) => {
          e.preventDefault();
          add("save:menu");
        }}
        onPress={() => add("save:press")}
        onClick={() => add("save:click")}
      >
        Save
      </Button>
      <Tabs class="grid gap-2">
        {/* Tablist element. */}
        <TabList aria-label="Greeting" translate="no" onPointerEnter={() => add("list:enter")} class="flex gap-1 border-b border-slate-200">
          {/* Tab elements. */}
          <Tab id="en" lang="en" class="cursor-default px-3 py-1 data-selected:border-b-2 data-selected:border-teal-700">
            English
          </Tab>
          <Tab
            id="fr"
            lang="fr"
            onPointerDown={() => add("tab:fr:down")}
            class="cursor-default px-3 py-1 data-selected:border-b-2 data-selected:border-teal-700"
          >
            Français
          </Tab>
        </TabList>
        {/* Panel elements. */}
        <TabPanel id="en" lang="en">
          {() => <p>Hello</p>}
        </TabPanel>
        <TabPanel id="fr" lang="fr">
          {() => <p>Bonjour</p>}
        </TabPanel>
      </Tabs>
      <output id="log" class="block font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
