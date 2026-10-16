import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@rivetjs/cdk/tabs";
import { SelectionIndicator } from "@rivetjs/cdk/selection-indicator";

export const head = { title: "Tabs with an animated selection indicator" };

const items = [
  { id: "overview", label: "Overview" },
  { id: "pricing", label: "Pricing" },
  { id: "changelog", label: "Changelog" },
];

// #region demo
export default function Pill() {
  return (
    <section class="m-4 max-w-lg text-sm">
      <Tabs id="pill" class="grid gap-3">
        <TabList aria-label="Product" items={items} class="flex gap-1 rounded-full bg-slate-100 p-1">
          {(item) => (
            <Tab
              id={item.id}
              class="relative cursor-default rounded-full px-4 py-1.5 font-medium text-slate-600 outline-none data-selected:text-white data-focus-visible:ring-2 data-focus-visible:ring-indigo-500"
            >
              <span class="relative z-10">{item.label}</span>
              {/* Rendered in the selected tab only; moves (translate + width) when the selection changes. */}
              <SelectionIndicator class="absolute inset-0 rounded-full bg-indigo-600 motion-safe:transition-[translate,width] motion-safe:duration-300" />
            </Tab>
          )}
        </TabList>
        <TabPanels items={items}>
          {(item) => (
            <TabPanel id={item.id} class="rounded-lg border border-slate-200 p-4 outline-none data-focus-visible:ring-2 data-focus-visible:ring-indigo-500">
              {() => <p>{item.label} content.</p>}
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </section>
  );
}
// #endregion
