// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tabs/overflow.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Tabs } from "@rivetjs/ui/tabs";

export const head = { title: "Tabs: Overflow" };

// #region demo
const items = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "reports", label: "Reports" },
  { id: "performance", label: "Performance" },
  { id: "engagement", label: "Engagement" },
  { id: "audience", label: "Audience" },
  { id: "acquisition", label: "Acquisition" },
  { id: "retention", label: "Retention" },
  { id: "settings", label: "Settings" },
];

export function Overflow() {
  return (
    <div class="w-[400px]">
      <Tabs>
        <Tabs.List aria-label="Overflow options">
          {items.map((item) => (
            <Tabs.Tab id={item.id}>{item.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        {items.map((item) => (
          <Tabs.Panel class="pt-4" id={item.id}>
            {() => <p>{item.label} panel content.</p>}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Overflow />
    </div>
  );
}
