// Rivet-authored ItemCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Languages } from "lucide";

export const head = { title: "ItemCard: With Select" };

// #region demo
export function WithSelect() {
  return (
    <div id="ic-select" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Languages} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Language</ItemCard.Title>
          <ItemCard.Description>Interface and emails</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Select aria-label="Language" class="w-36" defaultSelectedKey="english">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="english" textValue="English">
                  English
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="deutsch" textValue="Deutsch">
                  Deutsch
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="español" textValue="Español">
                  Español
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </ItemCard.Action>
      </ItemCard>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithSelect />
    </div>
  );
}
