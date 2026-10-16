import { signal } from "@rivetjs/reactivity";
import { Tabs, type Key } from "@rivetjs/cdk/tabs";
import { SelectionIndicator } from "@rivetjs/cdk/selection-indicator";

export const head = { title: "SelectionIndicator" };

const sections = [
  { id: "overview", label: "Overview" },
  { id: "specs", label: "Specifications" },
  { id: "faq", label: "FAQ" },
];

export default function SelectionIndicatorStory() {
  const tab = signal<Key | null>("overview");
  return (
    <section class="ind">
      <h1>SelectionIndicator</h1>
      <Tabs
        id="ind-tabs"
        aria-label="Indicator tabs"
        items={sections}
        selectedKey={tab}
        tab={(item) => (
          <>
            {item.label}
            <SelectionIndicator />
          </>
        )}
        panel={(item) => <p>{item.label} panel</p>}
      />
      <p id="ind-tab-value">Tab: {tab()}</p>
      <div class="ind-none">
        <Tabs
          id="ind-none"
          aria-label="No transition"
          items={sections}
          tab={(item) => (
            <>
              {item.label}
              <SelectionIndicator />
            </>
          )}
        />
      </div>
    </section>
  );
}
