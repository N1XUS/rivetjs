import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";
import { RouterProvider } from "@rivetjs/cdk/link";

export const head = { title: "Link tabs" };

// #region demo
export default function Links() {
  // Selection follows the URL: the router's navigate sets it (stands in for your router's location).
  const tab = signal<Key | null>("summary");
  const url = signal("/summary");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <RouterProvider
        navigate={(href) => {
          url.set(href);
          tab.set(href.slice(1));
        }}
      >
        {() => (
          <Tabs id="pages" selectedKey={tab}>
            <TabList aria-label="Pages">
              <Tab id="summary" href="/summary">
                Summary
              </Tab>
              <Tab id="details" href="/details">
                Details
              </Tab>
              <Tab id="docs" href="https://example.com/" target="_blank" rel="noreferrer">
                Docs (new tab)
              </Tab>
            </TabList>
            <TabPanel id="summary">{() => <p>Summary page.</p>}</TabPanel>
            <TabPanel id="details">{() => <p>Details page.</p>}</TabPanel>
            <TabPanel id="docs">{() => <p>Docs page.</p>}</TabPanel>
          </Tabs>
        )}
      </RouterProvider>
      <p id="url" class="text-slate-600">
        URL: {url()}
      </p>
    </section>
  );
}
// #endregion
