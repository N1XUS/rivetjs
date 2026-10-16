import { Tab, TabList, TabPanel, Tabs } from "@rivetjs/cdk/tabs";

export const head = { title: "Tabs with plain CSS" };

// #region demo
export default function Plain() {
  // No class props: the default rv-Tabs, rv-TabList, rv-Tab, rv-TabPanel classes.
  return (
    <Tabs id="plain">
      <TabList aria-label="Languages">
        <Tab id="html">HTML</Tab>
        <Tab id="css">CSS</Tab>
        <Tab id="wasm" isDisabled>
          WASM
        </Tab>
        <Tab id="js">JavaScript</Tab>
      </TabList>
      <TabPanel id="html">{() => <p>HTML reference.</p>}</TabPanel>
      <TabPanel id="css">{() => <p>CSS reference.</p>}</TabPanel>
      <TabPanel id="wasm">{() => <p>WASM reference.</p>}</TabPanel>
      <TabPanel id="js">{() => <p>JavaScript reference.</p>}</TabPanel>
    </Tabs>
  );
}
// #endregion
