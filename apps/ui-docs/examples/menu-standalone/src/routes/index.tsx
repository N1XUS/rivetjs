// Rivet-authored Menu demo (own content): a menu that is always on the page, without a trigger or popover.
import type { IconNode } from "@rivetjs/kit/icon";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { Menu } from "@rivetjs/ui/menu";
import { Surface } from "@rivetjs/ui/surface";
import { Archive, Copy, Pencil, Share2, Trash2 } from "lucide";

export const head = { title: "Menu: Standalone" };

// #region demo
type Action = { id: string; name: string; icon: IconNode; danger?: boolean };

const ACTIONS: Action[] = [
  { id: "edit", name: "Edit", icon: Pencil },
  { id: "duplicate", name: "Duplicate", icon: Copy },
  { id: "share", name: "Share", icon: Share2 },
  { id: "archive", name: "Archive", icon: Archive },
  { id: "delete", name: "Delete", icon: Trash2, danger: true },
];

export function Standalone() {
  const last = signal("none");

  return (
    <div class="flex flex-col items-center gap-3">
      <Surface class="w-64 rounded-3xl shadow-surface">
        <Menu id="menu-standalone" aria-label="Document actions" items={ACTIONS} disabledKeys={["archive"]} onAction={(key) => last.set(String(key))}>
          {(action: Action) => (
            <Menu.Item id={action.id} textValue={action.name} variant={action.danger ? "danger" : "default"}>
              <Icon icon={action.icon} size={16} class={action.danger ? "text-danger" : "text-muted"} />
              <Label>{action.name}</Label>
            </Menu.Item>
          )}
        </Menu>
      </Surface>
      <p id="menu-standalone-last" class="text-sm text-muted">
        Last action: {last()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Standalone />
    </div>
  );
}
