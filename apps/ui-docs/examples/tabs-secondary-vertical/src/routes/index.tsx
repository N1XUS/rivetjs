// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tabs/secondary-vertical.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Tabs } from "@rivetjs/ui/tabs";

export const head = { title: "Tabs: Secondary Variant Vertical" };

// #region demo
export function SecondaryVertical() {
  return (
    <Tabs class="w-full max-w-lg" orientation="vertical" variant="secondary">
      <Tabs.List aria-label="Vertical tabs">
        <Tabs.Tab id="account">Account</Tabs.Tab>
        <Tabs.Tab id="security">Security</Tabs.Tab>
        <Tabs.Tab id="notifications">Notifications</Tabs.Tab>
        <Tabs.Tab id="billing">Billing</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel class="px-4" id="account">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Account Settings</h3>
            <p class="text-sm text-muted">Manage your account information and preferences.</p>
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel class="px-4" id="security">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Security Settings</h3>
            <p class="text-sm text-muted">Configure two-factor authentication and password settings.</p>
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel class="px-4" id="notifications">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Notification Preferences</h3>
            <p class="text-sm text-muted">Choose how and when you want to receive notifications.</p>
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel class="px-4" id="billing">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Billing Information</h3>
            <p class="text-sm text-muted">View and manage your subscription and payment methods.</p>
          </>
        )}
      </Tabs.Panel>
    </Tabs>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SecondaryVertical />
    </div>
  );
}
