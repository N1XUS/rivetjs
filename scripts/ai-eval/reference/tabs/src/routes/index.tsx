import { signal } from "@rivetjs/reactivity";

export const head = { title: "Tabs" };

const tabs = ["Overview", "Specs", "Reviews"];

export default function Home() {
  const selected = signal(0);
  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    selected.set(next);
    document.getElementById(`tab-${next + 1}`)?.focus();
  };
  return (
    <main class="p-6">
      <div role="tablist" aria-label="Product">
        {tabs.map((name, index) => (
          <button
            id={`tab-${index + 1}`}
            type="button"
            role="tab"
            aria-controls="panel"
            aria-selected={selected() === index ? "true" : "false"}
            tabIndex={selected() === index ? 0 : -1}
            onClick={() => selected.set(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") select(index + 1);
              else if (event.key === "ArrowLeft") select(index - 1);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div id="panel" role="tabpanel" aria-labelledby={`tab-${selected() + 1}`}>
        {tabs[selected()]} content
      </div>
    </main>
  );
}
