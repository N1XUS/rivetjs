import { Tab, TabList, TabPanel, Tabs, type Orientation } from "@rivetjs/cdk/tabs";

export const head = { title: "Tabs with Tailwind" };

const items = [
  { id: "account", label: "Account" },
  { id: "team", label: "Team" },
  { id: "archived", label: "Archived", isDisabled: true },
  { id: "billing", label: "Billing" },
];

const tabClass =
  "cursor-default rounded-md px-3 py-1.5 font-medium text-slate-600 outline-none transition-colors data-hovered:bg-slate-100 " +
  "data-focus-visible:ring-2 data-focus-visible:ring-indigo-500 data-selected:bg-indigo-600 data-selected:text-white " +
  "data-disabled:cursor-not-allowed data-disabled:opacity-40";

// #region demo
function Workspace(props: { id: string; label: string; orientation?: Orientation }) {
  return (
    <Tabs id={props.id} orientation={props.orientation} class="grid gap-3 orientation-vertical:flex orientation-vertical:flex-row">
      <TabList aria-label={props.label} items={items} class="flex gap-1 rounded-lg bg-slate-50 p-1 orientation-vertical:flex-col">
        {(item) => (
          <Tab id={item.id} isDisabled={item.isDisabled} class={tabClass}>
            {item.label}
          </Tab>
        )}
      </TabList>
      <TabPanel id="account" class="flex-1 rounded-lg border border-slate-200 p-4 outline-none data-focus-visible:ring-2 data-focus-visible:ring-indigo-500">
        {() => <p>Account settings.</p>}
      </TabPanel>
      <TabPanel id="team" class="flex-1 rounded-lg border border-slate-200 p-4">
        {() => <p>Team settings.</p>}
      </TabPanel>
      <TabPanel id="billing" class="flex-1 rounded-lg border border-slate-200 p-4">
        {() => <p>Billing settings.</p>}
      </TabPanel>
    </Tabs>
  );
}

export default function Styled() {
  return (
    <section class="m-4 grid max-w-lg gap-6 text-sm">
      <Workspace id="tw" label="Workspace" />
      <Workspace id="twv" label="Workspace (vertical)" orientation="vertical" />
    </section>
  );
}
// #endregion
