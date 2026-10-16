import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@rivetjs/cdk/tabs";

export const head = { title: "Nested tabs" };

const languages = [
  { id: "ts", label: "TypeScript" },
  { id: "rs", label: "Rust" },
];
const topics = [
  { id: "install", label: "Install" },
  { id: "usage", label: "Usage" },
];

// #region demo
export default function Nested() {
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <Tabs id="lang">
        <TabList aria-label="Language" items={languages}>
          {(language) => <Tab id={language.id}>{language.label}</Tab>}
        </TabList>
        <TabPanels items={languages}>
          {(language) => (
            <TabPanel id={language.id}>
              {() => (
                // A panel can hold another Tabs: its own keyboard navigation, selection and ids.
                <Tabs id={"topic-" + language.id}>
                  <TabList aria-label={language.label + " topics"} items={topics}>
                    {(topic) => <Tab id={topic.id}>{topic.label}</Tab>}
                  </TabList>
                  <TabPanels items={topics}>
                    {(topic) => (
                      <TabPanel id={topic.id}>
                        {() => (
                          <p>
                            {language.label}: {topic.label}
                          </p>
                        )}
                      </TabPanel>
                    )}
                  </TabPanels>
                </Tabs>
              )}
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>
    </section>
  );
}
// #endregion
