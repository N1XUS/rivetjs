// Rivet-authored ListView demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { signal } from "@rivetjs/reactivity";
import { ListView } from "@rivetjs/ui/list-view";

export const head = { title: "ListView: Selection Modes" };

// #region demo
const PEOPLE = [
  { id: "ada", name: "Ada Lovelace", role: "Engineer" },
  { id: "alan", name: "Alan Turing", role: "Researcher" },
  { id: "grace", name: "Grace Hopper", role: "Rear admiral" },
  { id: "linus", name: "Linus Torvalds", role: "Maintainer" },
];

export function SelectionModes() {
  const selected = signal<Selection>(new Set());
  const count = () => {
    const keys = selected();
    return keys === "all" ? PEOPLE.length : keys.size;
  };
  const single = signal<Selection>(new Set(["alan"]));
  return (
    <div id="lv-select" class="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
      <div class="flex flex-col gap-2">
        <ListView aria-label="Team (multiple)" selectionMode="multiple" selectedKeys={selected}>
          {PEOPLE.map((p) => (
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
        <p id="lv-select-count" class="text-sm text-muted">
          {count()} selected
        </p>
      </div>
      <ListView aria-label="Team (single)" selectionMode="single" selectedKeys={single}>
        {PEOPLE.map((p) => (
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <SelectionModes />
    </div>
  );
}
