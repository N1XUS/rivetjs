import { Tab, TabList, TabPanel, Tabs } from "@rivetjs/cdk/tabs";

export const head = { title: "Right-to-left tabs" };

// #region demo
export default function Rtl() {
  // `dir` and `lang` are global DOM attributes: forwarded to the root element.
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="rtl" dir="rtl" lang="ar">
        <TabList aria-label="الأقسام">
          <Tab id="home">الرئيسية</Tab>
          <Tab id="news">الأخبار</Tab>
          <Tab id="about">من نحن</Tab>
        </TabList>
        <TabPanel id="home">{() => <p>الرئيسية</p>}</TabPanel>
        <TabPanel id="news">{() => <p>الأخبار</p>}</TabPanel>
        <TabPanel id="about">{() => <p>من نحن</p>}</TabPanel>
      </Tabs>
    </section>
  );
}
// #endregion
