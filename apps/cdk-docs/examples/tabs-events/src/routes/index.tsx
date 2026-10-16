import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Tabs selection events" };

// #region demo
export default function Views() {
  const log = signal<string[]>([]);
  // A local constant (or an inline arrow) resumes in the browser.
  const onSelectionChange = (key: Key) => log.update((entries) => [...entries, String(key)]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="views" onSelectionChange={onSelectionChange}>
        <TabList aria-label="Views">
          <Tab id="list">List</Tab>
          <Tab id="board">Board</Tab>
          <Tab id="calendar">Calendar</Tab>
        </TabList>
        <TabPanel id="list">{() => <p>List view.</p>}</TabPanel>
        <TabPanel id="board">{() => <p>Board view.</p>}</TabPanel>
        <TabPanel id="calendar">{() => <p>Calendar view.</p>}</TabPanel>
      </Tabs>
      <output id="log" class="text-slate-600">
        onSelectionChange: {log().join(", ") || "none"}
      </output>
    </section>
  );
}
// #endregion
