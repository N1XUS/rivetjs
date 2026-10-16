// ActionBar "clear selection" on a resumed page, shaped like the ui-docs `action-bar-basic` example: the demo is a named
// component inside the route module, the only handler in the bar is the icon-only X (`#abc-clear`, `onPress` writes a new
// empty Set to the two-way `selectedKeys` signal of ListBox `#abc-lb`); the other actions have no handler. `#abc` opens
// while anything is selected, prefix count `#abc-count`.
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";
import { ListBox } from "@rivetjs/ui/list-box";
import { Download, Trash2, X } from "lucide";

const FILES = ["Q3 report.pdf", "Budget 2027.xlsx", "Roadmap.key", "Team photo.jpg"];

export function Basic() {
  const selected = signal<Selection>(new Set());
  const count = () => {
    const keys = selected();
    return keys === "all" ? FILES.length : keys.size;
  };
  return (
    <div class="w-80">
      <ListBox id="abc-lb" aria-label="Files" selectionMode="multiple" selectedKeys={selected}>
        {FILES.map((file) => (
          <ListBox.Item id={file} textValue={file}>
            {file}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
      <ActionBar id="abc" isOpen={() => count() > 0}>
        <ActionBar.Prefix>
          <span id="abc-count">{count()}</span> selected
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button id="abc-download" variant="ghost" size="sm">
            <Icon icon={Download} size={16} />
            <span class="action-bar__label">Download</span>
          </Button>
          <Button variant="ghost" size="sm" class="text-danger">
            <Icon icon={Trash2} size={16} />
            <span class="action-bar__label">Delete</span>
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Button id="abc-clear" variant="ghost" size="sm" isIconOnly aria-label="Clear selection" onPress={() => selected.set(new Set())}>
            <Icon icon={X} size={16} />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>
    </div>
  );
}

export default function ActionBarClear() {
  return (
    <main class="p-6">
      <Basic />
    </main>
  );
}
