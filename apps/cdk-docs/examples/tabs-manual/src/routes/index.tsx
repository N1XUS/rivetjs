import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Manual keyboard activation" };

// #region demo
export default function Reports() {
  const tab = signal<Key | null>("daily");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="reports" keyboardActivation="manual" selectedKey={tab}>
        <TabList aria-label="Reports">
          <Tab id="daily">Daily</Tab>
          <Tab id="weekly">Weekly</Tab>
          <Tab id="monthly">Monthly</Tab>
        </TabList>
        <TabPanel id="daily">{() => <p>Daily report (expensive to render).</p>}</TabPanel>
        <TabPanel id="weekly">{() => <p>Weekly report (expensive to render).</p>}</TabPanel>
        <TabPanel id="monthly">{() => <p>Monthly report (expensive to render).</p>}</TabPanel>
      </Tabs>
      <p id="value" class="text-slate-600">
        Selected: {tab()}
      </p>
    </section>
  );
}
// #endregion
