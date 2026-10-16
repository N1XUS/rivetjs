import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Tabs" };

// #region demo
export default function Product() {
  const tab = signal<Key | null>("overview");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="product" selectedKey={tab}>
        <TabList aria-label="Product">
          <Tab id="overview">Overview</Tab>
          <Tab id="specs">Specs</Tab>
          <Tab id="reviews" isDisabled>
            Reviews
          </Tab>
          <Tab id="faq">FAQ</Tab>
        </TabList>
        {/* Only the selected panel is rendered: render-function children, so a panel created later resumes. */}
        <TabPanel id="overview">{() => <p>Overview of the product.</p>}</TabPanel>
        <TabPanel id="specs">{() => <p>Specs of the product.</p>}</TabPanel>
        <TabPanel id="reviews">{() => <p>Reviews of the product.</p>}</TabPanel>
        <TabPanel id="faq">{() => <p>FAQ of the product.</p>}</TabPanel>
      </Tabs>
      <p id="value" class="text-slate-600">
        Selected: {tab()}
      </p>
    </section>
  );
}
// #endregion
