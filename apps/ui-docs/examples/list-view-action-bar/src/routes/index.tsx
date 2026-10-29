// Rivet-authored ListView demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";
import { ListView } from "@rivetjs/ui/list-view";
import { Archive, Ellipsis, Trash2, X } from "lucide";

export const head = { title: "ListView: With Action Bar" };

// #region demo
const PEOPLE = [
  { id: "ada", name: "Ada Lovelace", role: "Engineer" },
  { id: "alan", name: "Alan Turing", role: "Researcher" },
  { id: "grace", name: "Grace Hopper", role: "Rear admiral" },
  { id: "linus", name: "Linus Torvalds", role: "Maintainer" },
];

export function WithActionBar() {
  const selected = signal<Selection>(new Set());
  const count = () => {
    const keys = selected();
    return keys === "all" ? PEOPLE.length : keys.size;
  };
  return (
    <div id="lv-bar" class="w-full max-w-md">
      <ListView aria-label="Team" selectionMode="multiple" selectedKeys={selected}>
        {PEOPLE.map((p) => (
          <ListView.Item id={p.id} textValue={p.name}>
            <ListView.ItemContent>
              <div>
                <ListView.Title>{p.name}</ListView.Title>
                <ListView.Description>{p.role}</ListView.Description>
              </div>
            </ListView.ItemContent>
            <ListView.ItemAction>
              <Button variant="ghost" size="sm" isIconOnly aria-label={`More for ${p.name}`}>
                <Icon icon={Ellipsis} size={16} />
              </Button>
            </ListView.ItemAction>
          </ListView.Item>
        ))}
      </ListView>
      <ActionBar isOpen={() => count() > 0}>
        <ActionBar.Prefix>
          <span id="lv-bar-count">{count()}</span> selected
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button variant="ghost" size="sm">
            <Icon icon={Archive} size={16} />
            <span class="action-bar__label">Archive</span>
          </Button>
          <Button variant="ghost" size="sm" class="text-danger">
            <Icon icon={Trash2} size={16} />
            <span class="action-bar__label">Remove</span>
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Button variant="ghost" size="sm" isIconOnly aria-label="Clear selection" onPress={() => selected.set(new Set())}>
            <Icon icon={X} size={16} />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithActionBar />
    </div>
  );
}
