// Rivet-authored ActionBar demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ActionBar } from "@rivetjs/ui/action-bar";
import { Button } from "@rivetjs/ui/button";
import { ListBox } from "@rivetjs/ui/list-box";
import { Archive, Download, Trash2, X } from "lucide";

export const head = { title: "ActionBar: Usage" };

// #region demo
const FILES = ["Q3 report.pdf", "Budget 2027.xlsx", "Roadmap.key", "Team photo.jpg", "Contract draft.docx"];

export function Basic() {
  const selected = signal<Selection>(new Set());
  const count = () => {
    const keys = selected();
    return keys === "all" ? FILES.length : keys.size;
  };
  return (
    <div class="w-80">
      <ListBox aria-label="Files" selectionMode="multiple" selectedKeys={selected}>
        {FILES.map((file) => (
          <ListBox.Item id={file} textValue={file}>
            {file}
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
      </ListBox>
      <ActionBar isOpen={() => count() > 0}>
        <ActionBar.Prefix>
          <span id="action-bar-count">{count()}</span> selected
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button variant="ghost" size="sm">
            <Icon icon={Download} size={16} />
            <span class="action-bar__label">Download</span>
          </Button>
          <Button variant="ghost" size="sm">
            <Icon icon={Archive} size={16} />
            <span class="action-bar__label">Archive</span>
          </Button>
          <Button variant="ghost" size="sm" class="text-danger">
            <Icon icon={Trash2} size={16} />
            <span class="action-bar__label">Delete</span>
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
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
