// Rivet-authored ItemCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Mail } from "lucide";

export const head = { title: "ItemCard: Email Setting" };

// #region demo
export function EmailSetting() {
  return (
    <div id="ic-email" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Mail} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Email digest</ItemCard.Title>
          <ItemCard.Description>A summary of activity in your workspace</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Select aria-label="Digest frequency" class="w-36" defaultSelectedKey="weekly">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="daily" textValue="Daily">
                  Daily
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="weekly" textValue="Weekly">
                  Weekly
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="never" textValue="Never">
                  Never
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
      <EmailSetting />
    </div>
  );
}
