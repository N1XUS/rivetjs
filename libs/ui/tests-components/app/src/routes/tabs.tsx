// Tabs on a resumed page: `#tabs` (ListContainer, overview / analytics / disabled reports; `#tabs-key` shows the
// `onSelectionChange` key; unselected panels are render functions), `#tabs-overflow` (9 tabs in a 300 px box: scroll buttons),
// `#tabs-vertical` (secondary, vertical), `#tabs-plain` (List `container={false}`, Separator) and `#tabs-auto` (no explicit
// `Tabs.Indicator`: every Tab appends its own; Tab without ListContainer, as the settings showcase), `#tabs-auto-vertical`
// (automatic indicators, vertical) and `#tabs-lazy` (an explicit `Tabs.Indicator` mounted later by `<Show>`: replaces the
// automatic one, never two).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Tabs } from "@rivetjs/ui/tabs";

const overflow = ["Overview", "Analytics", "Reports", "Performance", "Engagement", "Audience", "Acquisition", "Retention", "Settings"];

export default function TabsStories() {
  const selected = signal("none");
  const explicit = signal(false);
  return (
    <section class="flex w-[480px] flex-col gap-10 p-10">
      <span id="tabs-key">{selected()}</span>
      <Tabs id="tabs" class="w-full max-w-md" onSelectionChange={(k) => selected.set(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Options">
            <Tabs.Tab id="overview">
              Overview
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="analytics">
              Analytics
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab isDisabled id="reports">
              Reports
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel class="pt-4" id="overview">
          <p>View your project overview and recent activity.</p>
        </Tabs.Panel>
        <Tabs.Panel class="pt-4" id="analytics">
          {() => <p>Track your metrics and analyze performance data.</p>}
        </Tabs.Panel>
        <Tabs.Panel class="pt-4" id="reports">
          {() => <p>Generate and download detailed reports.</p>}
        </Tabs.Panel>
      </Tabs>
      <div class="w-[300px]">
        <Tabs id="tabs-overflow">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Overflow options">
              {overflow.map((label) => (
                <Tabs.Tab id={label.toLowerCase()}>
                  {label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>
      <Tabs id="tabs-vertical" class="w-full max-w-lg" orientation="vertical" variant="secondary">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Vertical tabs">
            <Tabs.Tab id="account">
              Account
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="security">
              Security
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel class="px-4" id="account">
          Account settings
        </Tabs.Panel>
        <Tabs.Panel class="px-4" id="security">
          {() => "Security settings"}
        </Tabs.Panel>
      </Tabs>
      <Tabs id="tabs-auto" aria-label="Automatic">
        <Tabs.List aria-label="Automatic">
          <Tabs.Tab id="profile">Profile</Tabs.Tab>
          <Tabs.Tab id="notifications">Notifications</Tabs.Tab>
          <Tabs.Tab id="appearance">Appearance</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="profile">Profile panel</Tabs.Panel>
        <Tabs.Panel id="notifications">Notifications panel</Tabs.Panel>
        <Tabs.Panel id="appearance">Appearance panel</Tabs.Panel>
      </Tabs>
      <Tabs id="tabs-auto-vertical" aria-label="Automatic vertical" orientation="vertical">
        <Tabs.List aria-label="Automatic vertical">
          <Tabs.Tab id="general">General</Tabs.Tab>
          <Tabs.Tab id="security">Security</Tabs.Tab>
          <Tabs.Tab id="billing">Billing</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="general">General panel</Tabs.Panel>
        <Tabs.Panel id="security">Security panel</Tabs.Panel>
        <Tabs.Panel id="billing">Billing panel</Tabs.Panel>
      </Tabs>
      <button id="tabs-lazy-toggle" type="button" onClick={() => explicit.set(!explicit())}>
        Explicit indicators
      </button>
      <Tabs id="tabs-lazy" aria-label="Lazy indicator">
        <Tabs.List aria-label="Lazy indicator">
          <Tabs.Tab id="first">
            First
            <Show when={explicit}>{() => <Tabs.Indicator />}</Show>
          </Tabs.Tab>
          <Tabs.Tab id="second">
            Second
            <Show when={explicit}>{() => <Tabs.Indicator />}</Show>
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="first">First panel</Tabs.Panel>
        <Tabs.Panel id="second">Second panel</Tabs.Panel>
      </Tabs>
      <Tabs id="tabs-plain">
        <Tabs.List aria-label="Plain" container={false}>
          <Tabs.Tab id="one">
            One
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="two">
            <Tabs.Separator />
            Two
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </section>
  );
}
