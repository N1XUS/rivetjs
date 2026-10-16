// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tabs/vertical-alignment.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Tabs } from "@rivetjs/ui/tabs";

export const head = { title: "Tabs: Alignment" };

// #region demo
export function VerticalAlignment() {
  return (
    <Tabs align="start" class="w-full max-w-lg" orientation="vertical" variant="secondary">
      <Tabs.List aria-label="Settings">
        <Tabs.Tab id="general">General</Tabs.Tab>
        <Tabs.Tab id="billing">Subscription &amp; Billing</Tabs.Tab>
        <Tabs.Tab id="appearance">Appearance</Tabs.Tab>
        <Tabs.Tab id="notifications">Notifications</Tabs.Tab>
        <Tabs.Tab id="privacy">Privacy</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel class="px-4" id="general">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">General</h3>
            <p class="text-sm text-muted">Manage your account information and preferences.</p>
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel class="px-4" id="billing">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Subscription &amp; Billing</h3>
            <p class="text-sm text-muted">View and manage your plan and payment methods.</p>
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel class="px-4" id="appearance">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Appearance</h3>
            <p class="text-sm text-muted">Choose a theme and adjust the interface density.</p>
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel class="px-4" id="notifications">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Notifications</h3>
            <p class="text-sm text-muted">Choose how and when you want to receive notifications.</p>
          </>
        )}
      </Tabs.Panel>
      <Tabs.Panel class="px-4" id="privacy">
        {() => (
          <>
            <h3 class="mb-2 font-semibold">Privacy</h3>
            <p class="text-sm text-muted">Control what you share and who can see your activity.</p>
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
      <VerticalAlignment />
    </div>
  );
}
