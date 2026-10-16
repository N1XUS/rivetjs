import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Controlled and uncontrolled tabs" };

// #region demo
export default function Checkout() {
  // Controlled: a two-way signal. Number keys keep their type.
  const step = signal<Key | null>(1);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="checkout" selectedKey={step}>
        <TabList aria-label="Checkout">
          <Tab id={1}>Cart</Tab>
          <Tab id={2}>Shipping</Tab>
          <Tab id={3}>Payment</Tab>
        </TabList>
        <TabPanel id={1}>{() => <p>Step 1: Cart</p>}</TabPanel>
        <TabPanel id={2}>{() => <p>Step 2: Shipping</p>}</TabPanel>
        <TabPanel id={3}>{() => <p>Step 3: Payment</p>}</TabPanel>
      </Tabs>
      <p id="value" class="text-slate-600">
        Step: {String(step())} ({typeof step()})
      </p>
      <div class="flex gap-2">
        <button type="button" id="prev" class="rounded border px-2 py-1" onClick={() => step.set(Math.max(1, Number(step()) - 1))}>
          Back
        </button>
        <button type="button" id="next" class="rounded border px-2 py-1" onClick={() => step.set(Math.min(3, Number(step()) + 1))}>
          Continue
        </button>
      </div>
      {/* Uncontrolled: only the initial key. */}
      <Tabs id="docs" defaultSelectedKey="css">
        <TabList aria-label="Docs">
          <Tab id="html">HTML</Tab>
          <Tab id="css">CSS</Tab>
          <Tab id="js">JS</Tab>
        </TabList>
        <TabPanel id="html">{() => <p>HTML docs.</p>}</TabPanel>
        <TabPanel id="css">{() => <p>CSS docs.</p>}</TabPanel>
        <TabPanel id="js">{() => <p>JS docs.</p>}</TabPanel>
      </Tabs>
    </section>
  );
}
// #endregion
