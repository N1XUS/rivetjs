import { Tab, TabList, TabPanel, TabPanels, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Disabled tabs" };

const plans = [
  { id: "free", label: "Free" },
  { id: "pro", label: "Pro" },
  { id: "team", label: "Team" },
  { id: "enterprise", label: "Enterprise" },
];

// #region demo
export default function Plans() {
  return (
    <section class="m-4 grid max-w-md gap-6 text-sm">
      {/* One tab disabled with isDisabled. */}
      <Tabs id="item">
        <TabList aria-label="Item disabled" items={plans}>
          {(plan) => (
            <Tab id={plan.id} isDisabled={plan.id === "team"}>
              {plan.label}
            </Tab>
          )}
        </TabList>
        <TabPanels items={plans}>{(plan) => <TabPanel id={plan.id}>{() => <p>{plan.label} plan.</p>}</TabPanel>}</TabPanels>
      </Tabs>
      {/* disabledKeys: the first tab is disabled, so the first enabled one is selected by default. */}
      <Tabs id="keys" disabledKeys={["free", "team", "enterprise"] as Key[]}>
        <TabList aria-label="Disabled keys" items={plans}>
          {(plan) => <Tab id={plan.id}>{plan.label}</Tab>}
        </TabList>
        <TabPanels items={plans}>{(plan) => <TabPanel id={plan.id}>{() => <p>{plan.label} plan.</p>}</TabPanel>}</TabPanels>
      </Tabs>
      {/* The whole tab list disabled. */}
      <Tabs id="all" isDisabled>
        <TabList aria-label="All disabled" items={plans}>
          {(plan) => <Tab id={plan.id}>{plan.label}</Tab>}
        </TabList>
        <TabPanels items={plans}>{(plan) => <TabPanel id={plan.id}>{() => <p>{plan.label} plan.</p>}</TabPanel>}</TabPanels>
      </Tabs>
    </section>
  );
}
// #endregion
