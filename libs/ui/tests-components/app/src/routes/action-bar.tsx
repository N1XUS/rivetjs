// ActionBar on a resumed page (Rivet-authored; feature set inspired by HeroUI Pro's public ActionBar docs), wired to a ui ListBox
// selection: `#lb` multiple selection (two-way `selectedKeys` signal), `#ab` opens while anything is selected; prefix count
// `#ab-count`, actions `#ab-archive` (icon + responsive `action-bar__label`; `onPress` → `#ab-archived`) / `#ab-delete`,
// `#ab-clear` empties the selection.
import type { Selection } from "@rivetjs/cdk/listbox";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";
import { ListBox } from "@rivetjs/ui/list-box";
import { Archive, Trash2, X } from "lucide";

export default function ActionBarStories() {
  const selected = signal<Selection>(new Set());
  const archived = signal(0);
  const count = () => {
    const keys = selected();
    return keys === "all" ? 4 : keys.size;
  };
  return (
    <main class="p-6">
      <ListBox id="lb" aria-label="Files" selectionMode="multiple" selectedKeys={selected}>
        <ListBox.Item id="report" textValue="Report">
          Report
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="budget" textValue="Budget">
          Budget
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="roadmap" textValue="Roadmap">
          Roadmap
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="notes" textValue="Notes">
          Notes
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
      <output id="ab-archived">{archived()}</output>
      <ActionBar id="ab" isOpen={() => count() > 0}>
        <ActionBar.Prefix>
          <span id="ab-count">{count()}</span> selected
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button id="ab-archive" variant="ghost" size="sm" onPress={() => archived.set(archived() + 1)}>
            <Icon icon={Archive} size={16} />
            <span class="action-bar__label">Archive</span>
          </Button>
          <Button id="ab-delete" variant="ghost" size="sm">
            <Icon icon={Trash2} size={16} />
            <span class="action-bar__label">Delete</span>
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Button id="ab-clear" variant="ghost" size="sm" isIconOnly aria-label="Clear selection" onPress={() => selected.set(new Set())}>
            <Icon icon={X} size={16} />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>
    </main>
  );
}
