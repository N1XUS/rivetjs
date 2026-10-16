// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tabs/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Tabs } from "@rivetjs/ui/tabs";

export const head = { title: "Tabs: Usage" };

// #region demo
export function Basic() {
  return (
    <Tabs class="w-full max-w-md">
      <Tabs.List aria-label="Options">
        <Tabs.Tab id="overview">Overview</Tabs.Tab>
        <Tabs.Tab id="analytics">Analytics</Tabs.Tab>
        <Tabs.Tab id="reports">Reports</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel class="pt-4" id="overview">
        {() => <p>View your project overview and recent activity.</p>}
      </Tabs.Panel>
      <Tabs.Panel class="pt-4" id="analytics">
        {() => <p>Track your metrics and analyze performance data.</p>}
      </Tabs.Panel>
      <Tabs.Panel class="pt-4" id="reports">
        {() => <p>Generate and download detailed reports.</p>}
      </Tabs.Panel>
    </Tabs>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
