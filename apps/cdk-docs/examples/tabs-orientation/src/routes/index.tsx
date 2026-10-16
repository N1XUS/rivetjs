import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Vertical tabs" };

// #region demo
export default function Settings() {
  const tab = signal<Key | null>("profile");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="settings" orientation="vertical" selectedKey={tab}>
        <TabList aria-label="Settings">
          <Tab id="profile">Profile</Tab>
          <Tab id="security">Security</Tab>
          <Tab id="billing">Billing</Tab>
        </TabList>
        <TabPanel id="profile">{() => <p>Profile settings.</p>}</TabPanel>
        <TabPanel id="security">{() => <p>Security settings.</p>}</TabPanel>
        <TabPanel id="billing">{() => <p>Billing settings.</p>}</TabPanel>
      </Tabs>
      <p id="value" class="text-slate-600">
        Selected: {tab()}
      </p>
    </section>
  );
}
// #endregion
