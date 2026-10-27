import { signal } from "@rivetjs/reactivity";
import { ListView } from "@rivetjs/ui/list-view";

export const head = { title: "ListView" };

const ROWS = Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `Item ${i + 1}` }));

const people = [
  { id: "ada", name: "Ada Lovelace", role: "Engineer" },
  { id: "alan", name: "Alan Turing", role: "Researcher" },
  { id: "grace", name: "Grace Hopper", role: "Admiral" },
];

// Rivet addition (feature set inspired by HeroUI Pro's public List View docs): a multiple-selection list with a disabled row
// and a plain list with row actions. Resumes on the first press / key.
export default function ListViewStory() {
  const count = signal(0);
  const last = signal("");
  return (
    <main class="flex max-w-xl flex-col gap-8 bg-background p-6 text-foreground">
      <ListView
        id="lv-select"
        aria-label="People"
        selectionMode="multiple"
        disabledKeys={["grace"]}
        onSelectionChange={(keys) => count.set(keys === "all" ? people.length : keys.size)}
      >
        {people.map((p) => (
          <ListView.Item id={p.id} textValue={p.name}>
            <ListView.ItemContent>
              <div>
                <ListView.Title>{p.name}</ListView.Title>
                <ListView.Description>{p.role}</ListView.Description>
              </div>
            </ListView.ItemContent>
          </ListView.Item>
        ))}
      </ListView>
      <p id="lv-count">{count()} selected</p>
      <ListView id="lv-action" aria-label="Files" variant="secondary" onAction={(key) => last.set(String(key))}>
        <ListView.Item id="report" textValue="Report">
          Report
        </ListView.Item>
        <ListView.Item id="notes" textValue="Notes">
          Notes
        </ListView.Item>
      </ListView>
      <p id="lv-last">{last()}</p>
      <ListView id="lv-virtual" aria-label="Many" items={ROWS} virtualized rowHeight={44} class="h-80 overflow-auto" initialSize={{ width: 528, height: 320 }}>
        {(row: { id: number; name: string }) => <ListView.Item textValue={row.name}>{row.name}</ListView.Item>}
      </ListView>
    </main>
  );
}
