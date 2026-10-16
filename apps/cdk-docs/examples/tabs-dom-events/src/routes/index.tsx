import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Tabs DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  const tab = signal<Key | null>("one");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      {/* Each part forwards global DOM events and attributes to its own element. */}
      <Tabs id="dom" selectedKey={tab} lang="en" onPointerEnter={() => add("root:pointerenter")}>
        <TabList aria-label="DOM events" dir="ltr" onDblClick={() => add("list:dblclick")}>
          <Tab id="one" onContextMenu={(e) => (e.preventDefault(), add("tab-one:contextmenu"))}>
            One
          </Tab>
          <Tab id="two" lang="it" onPointerUp={() => add("tab-two:pointerup")}>
            Two
          </Tab>
        </TabList>
        <TabPanel id="one">
          {() => (
            <p id="body-one" class="p-2">
              One panel
            </p>
          )}
        </TabPanel>
        <TabPanel id="two" lang="es" onClick={() => add("panel-two:click")}>
          {() => (
            <p id="body-two" class="p-2">
              Two panel
            </p>
          )}
        </TabPanel>
      </Tabs>
      <output id="log" class="text-slate-600">
        {log().join(", ") || "none"}
      </output>
      <p id="value">Selected: {String(tab())}</p>
    </section>
  );
}
// #endregion
