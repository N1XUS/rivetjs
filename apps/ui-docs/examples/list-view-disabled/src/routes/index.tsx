// Rivet-authored ListView demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ListView } from "@rivetjs/ui/list-view";

export const head = { title: "ListView: Disabled Items" };

// #region demo
const PEOPLE = [
  { id: "ada", name: "Ada Lovelace", role: "Engineer" },
  { id: "alan", name: "Alan Turing", role: "Researcher" },
  { id: "grace", name: "Grace Hopper", role: "Rear admiral" },
  { id: "linus", name: "Linus Torvalds", role: "Maintainer" },
];

export function Disabled() {
  return (
    <div id="lv-disabled" class="w-full max-w-md">
      <ListView aria-label="Team" selectionMode="multiple" disabledKeys={["grace", "linus"]}>
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
      <Disabled />
    </div>
  );
}
