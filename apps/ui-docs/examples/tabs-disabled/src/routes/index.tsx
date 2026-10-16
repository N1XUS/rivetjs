// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tabs/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Tabs } from "@rivetjs/ui/tabs";

export const head = { title: "Tabs: Disabled Tab" };

// #region demo
export function Disabled() {
  return (
    <Tabs class="w-full max-w-md">
      <Tabs.List aria-label="Tabs with disabled">
        <Tabs.Tab id="active">Active</Tabs.Tab>
        <Tabs.Tab isDisabled id="disabled">
          Disabled
        </Tabs.Tab>
        <Tabs.Tab id="available">Available</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel class="pt-4" id="active">
        {() => <p>This tab is active and can be selected.</p>}
      </Tabs.Panel>
      <Tabs.Panel class="pt-4" id="disabled">
        {() => <p>This content cannot be accessed.</p>}
      </Tabs.Panel>
      <Tabs.Panel class="pt-4" id="available">
        {() => <p>This tab is also available for selection.</p>}
      </Tabs.Panel>
    </Tabs>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
