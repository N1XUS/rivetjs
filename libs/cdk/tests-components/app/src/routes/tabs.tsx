import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, TabPanels, Tabs, type Key } from "@rivetjs/cdk/tabs";

export const head = { title: "Tabs" };

const sections = [
  { id: "overview", label: "Overview" },
  { id: "specs", label: "Specs" },
  { id: "reviews", label: "Reviews", isDisabled: true },
  { id: "faq", label: "FAQ" },
];

const numbered = [
  { id: 1, label: "One" },
  { id: 2, label: "Two" },
  { id: 3, label: "Three" },
];

const links = [
  { id: "a", label: "Section A", href: "#section-a" },
  { id: "b", label: "Section B", href: "#section-b" },
];

export default function TabsStory() {
  const tab = signal<Key | null>("specs");
  const num = signal<Key | null>(2);
  const changes = signal(0);
  const outer = signal<Key | null>("first");
  const partsChanges = signal<string>("");
  return (
    <section>
      <h1>Tabs</h1>
      <Tabs id="product" aria-label="Product" items={sections} selectedKey={tab} panel={(item) => <p>{item.label} panel content</p>} />
      <p id="tab-value">Tab: {tab()}</p>
      <button type="button" id="pick-faq" onClick={() => tab.set("faq")}>
        Show FAQ
      </button>
      <Tabs
        id="manual"
        aria-label="Settings"
        orientation="vertical"
        keyboardActivation="manual"
        items={sections}
        panel={(item) => <p>{item.label} settings</p>}
      />
      <div dir="rtl">
        <Tabs id="rtl" aria-label="RTL" items={sections} panel={(item) => <p>{item.label}</p>} />
      </div>
      <Tabs id="off" aria-label="Disabled" isDisabled items={sections} panel={(item) => <p>{item.label}</p>} />
      <Tabs id="keys" aria-label="Disabled keys" disabledKeys={["overview"]} items={sections} panel={(item) => <p>{item.label}</p>} />
      <Tabs
        id="num"
        aria-label="Numbers"
        items={numbered}
        selectedKey={num}
        onSelectionChange={() => changes.set(changes() + 1)}
        panel={(item) => (
          <p>
            {item.label} <button type="button">Inside {item.label}</button>
          </p>
        )}
      />
      <p id="num-value">
        Num: {String(num())} ({typeof num()}), changes: {changes()}
      </p>
      <Tabs id="links" aria-label="Links" items={links} defaultSelectedKey="a" panel={(item) => <p>{item.label} content</p>} />
      <Tabs
        id="outer"
        aria-label="Outer"
        items={[
          { id: "first", label: "First" },
          { id: "second", label: "Second" },
        ]}
        selectedKey={outer}
        panel={(item) => <Tabs id={"inner-" + item.id} aria-label={"Inner " + item.label} items={numbered} panel={(inner) => <p>Inner {inner.label}</p>} />}
      />
      {/* RAC parts: default selection from the build pass (first enabled tab); unselected panels render on selection (render-function children). */}
      <Tabs id="parts" onSelectionChange={(key) => partsChanges.set(partsChanges() + String(key))}>
        {({ orientation }) => (
          <>
            <TabList aria-label={"Parts " + orientation()}>
              <Tab id="pa" isDisabled>
                Disabled first
              </Tab>
              <Tab id="pb" class={({ isSelected }) => (isSelected() ? "rv-Tab on" : "rv-Tab off")}>
                {({ isSelected }) => <span class="pb-label">{isSelected() ? "B (selected)" : "B"}</span>}
              </Tab>
              <Tab id="pc">C</Tab>
            </TabList>
            <TabPanels>
              <TabPanel id="pa">{() => <p>Panel A</p>}</TabPanel>
              <TabPanel id="pb">
                {() => (
                  <p>
                    Panel B <button type="button">In B</button>
                  </p>
                )}
              </TabPanel>
              <TabPanel id="pc">{() => <p>Panel C</p>}</TabPanel>
            </TabPanels>
          </>
        )}
      </Tabs>
      <p id="parts-changes">Changes: {partsChanges()}</p>
      {/* RAC parts with `items` on TabList / TabPanels (cdk-docs tabs-nested shape): the unselected row's panel renders on selection. */}
      <Tabs id="item-parts">
        <TabList aria-label="Item parts" items={sections}>
          {(section) => <Tab id={section.id}>{section.label}</Tab>}
        </TabList>
        <TabPanels items={sections}>{(section) => <TabPanel id={section.id}>{() => <p>{section.label} item panel</p>}</TabPanel>}</TabPanels>
      </Tabs>
      <div class="spacer"></div>
    </section>
  );
}
