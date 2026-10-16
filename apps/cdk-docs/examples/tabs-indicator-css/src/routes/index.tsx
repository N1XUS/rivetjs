import { Tab, TabList, TabPanel, Tabs } from "@rivetjs/cdk/tabs";
import { SelectionIndicator } from "@rivetjs/cdk/selection-indicator";

export const head = { title: "Selection indicator with plain CSS" };

// #region demo
export default function Underline() {
  return (
    <Tabs id="underline">
      <TabList aria-label="Languages">
        <Tab id="html">
          HTML
          <SelectionIndicator />
        </Tab>
        <Tab id="css">
          CSS
          <SelectionIndicator />
        </Tab>
        <Tab id="javascript">
          JavaScript
          <SelectionIndicator />
        </Tab>
      </TabList>
      <TabPanel id="html">{() => <p>HTML reference.</p>}</TabPanel>
      <TabPanel id="css">{() => <p>CSS reference.</p>}</TabPanel>
      <TabPanel id="javascript">{() => <p>JavaScript reference.</p>}</TabPanel>
    </Tabs>
  );
}
// #endregion
