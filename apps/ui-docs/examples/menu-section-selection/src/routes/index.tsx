// Rivet-authored MenuSection demo (own content): each section keeps its own selection.
import type { Selection } from "@rivetjs/cdk/menu";
import { signal } from "@rivetjs/reactivity";
import { Header } from "@rivetjs/ui/header";
import { Label } from "@rivetjs/ui/label";
import { Menu } from "@rivetjs/ui/menu";
import { Separator } from "@rivetjs/ui/separator";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "MenuSection: Section Selection" };

// #region demo
export function SectionSelection() {
  const sort = signal<Selection>(new Set(["date"]));
  const columns = signal<Selection>(new Set(["owner", "size"]));
  const list = (keys: Selection) => (keys === "all" ? "all" : [...keys].join(", ") || "none");

  return (
    <div class="flex flex-col items-center gap-3">
      <Surface class="w-64 rounded-3xl shadow-surface">
        <Menu id="menu-view" aria-label="View options">
          <Menu.Section id="sort" selectionMode="single" disallowEmptySelection selectedKeys={sort}>
            <Header>Sort by</Header>
            <Menu.Item id="name" textValue="Name">
              <Menu.ItemIndicator type="dot" />
              <Label>Name</Label>
            </Menu.Item>
            <Menu.Item id="date" textValue="Date modified">
              <Menu.ItemIndicator type="dot" />
              <Label>Date modified</Label>
            </Menu.Item>
            <Menu.Item id="kind" textValue="Kind">
              <Menu.ItemIndicator type="dot" />
              <Label>Kind</Label>
            </Menu.Item>
          </Menu.Section>
          <Separator />
          <Menu.Section id="columns" selectionMode="multiple" selectedKeys={columns}>
            <Header>Columns</Header>
            <Menu.Item id="owner" textValue="Owner">
              <Menu.ItemIndicator />
              <Label>Owner</Label>
            </Menu.Item>
            <Menu.Item id="size" textValue="Size">
              <Menu.ItemIndicator />
              <Label>Size</Label>
            </Menu.Item>
            <Menu.Item id="tags" textValue="Tags">
              <Menu.ItemIndicator />
              <Label>Tags</Label>
            </Menu.Item>
          </Menu.Section>
        </Menu>
      </Surface>
      <p id="menu-view-state" class="text-sm text-muted">
        Sort: {list(sort())} · Columns: {list(columns())}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SectionSelection />
    </div>
  );
}
