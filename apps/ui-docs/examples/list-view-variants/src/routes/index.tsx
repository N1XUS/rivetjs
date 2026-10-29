// Rivet-authored ListView demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ListView } from "@rivetjs/ui/list-view";

export const head = { title: "ListView: Variants" };

// #region demo
const PEOPLE = [
  { id: "ada", name: "Ada Lovelace", role: "Engineer" },
  { id: "alan", name: "Alan Turing", role: "Researcher" },
  { id: "grace", name: "Grace Hopper", role: "Rear admiral" },
  { id: "linus", name: "Linus Torvalds", role: "Maintainer" },
];

export function Variants() {
  return (
    <div class="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
      <ListView aria-label="Primary" variant="primary">
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
      <ListView aria-label="Secondary" variant="secondary">
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
      <Variants />
    </div>
  );
}
