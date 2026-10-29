// Rivet-authored InlineSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Avatar } from "@rivetjs/ui/avatar";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "InlineSelect: Team Switcher" };

// #region demo
export function TeamSwitcher() {
  return (
    <div class="flex items-center gap-2 text-sm">
      <Avatar size="sm" color="accent">
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar>
      <InlineSelect defaultValue="acme" aria-label="Team">
        <InlineSelect.Trigger>
          <InlineSelect.Value />
          <InlineSelect.Indicator />
        </InlineSelect.Trigger>
        <InlineSelect.Popover>
          <ListBox>
            <ListBox.Item id="acme" textValue="Acme Inc.">
              Acme Inc.
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="globex" textValue="Globex">
              Globex
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="initech" textValue="Initech">
              Initech
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </InlineSelect.Popover>
      </InlineSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TeamSwitcher />
    </div>
  );
}
