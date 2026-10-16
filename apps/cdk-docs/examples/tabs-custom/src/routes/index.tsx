import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Tabs with custom elements" };

// #region demo
export default function Custom() {
  const wind = signal<Key | null>("north");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="wind" selectedKey={wind}>
        {/* render: your own element; spread the props it receives (ARIA, handlers, reactive attributes). */}
        <TabList aria-label="Wind" render={(props) => <ul {...(props as {})} class="m-0 flex list-none gap-2 p-0" />}>
          <Tab id="north" render={(props) => <li {...(props as {})} class="rounded border px-2 py-1 data-selected:bg-slate-900 data-selected:text-white" />}>
            North
          </Tab>
          <Tab id="south" render={(props) => <li {...(props as {})} class="rounded border px-2 py-1 data-selected:bg-slate-900 data-selected:text-white" />}>
            South
          </Tab>
          <Tab id="east" render={(props) => <li {...(props as {})} class="rounded border px-2 py-1 data-selected:bg-slate-900 data-selected:text-white" />}>
            East
          </Tab>
        </TabList>
        <TabPanel id="north">{() => <p>Wind from the north.</p>}</TabPanel>
        <TabPanel id="south">{() => <p>Wind from the south.</p>}</TabPanel>
        <TabPanel id="east">{() => <p>Wind from the east.</p>}</TabPanel>
      </Tabs>
      <p id="value">Selected: {String(wind())}</p>
    </section>
  );
}
// #endregion
