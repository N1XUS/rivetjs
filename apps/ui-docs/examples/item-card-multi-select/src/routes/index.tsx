// Rivet-authored ItemCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Megaphone } from "lucide";

export const head = { title: "ItemCard: With Multi Select" };

// #region demo
export function WithMultiSelect() {
  return (
    <div id="ic-multi" class="flex w-full max-w-md flex-col gap-3">
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={Megaphone} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Product updates</ItemCard.Title>
          <ItemCard.Description>Where we tell you about new features</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Select aria-label="Channels" class="w-40" selectionMode="multiple" defaultValue={["email"]}>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox selectionMode="multiple">
                <ListBox.Item id="email" textValue="Email">
                  Email
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="push" textValue="Push">
                  Push
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="sms" textValue="SMS">
                  SMS
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
      <WithMultiSelect />
    </div>
  );
}
