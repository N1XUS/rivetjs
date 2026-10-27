// Rivet-authored ItemCardGroup demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { User } from "lucide";

export const head = { title: "ItemCardGroup: Permission Levels" };

// #region demo
export function PermissionLevels() {
  return (
    <ItemCardGroup id="icg-perms" class="w-full max-w-lg" aria-labelledby="icg-perms-title">
      <ItemCardGroup.Header>
        <ItemCardGroup.Title id="icg-perms-title">Members</ItemCardGroup.Title>
        <ItemCardGroup.Description>3 people have access</ItemCardGroup.Description>
      </ItemCardGroup.Header>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={User} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Dana Ruiz</ItemCard.Title>
          <ItemCard.Description>dana@example.com</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Select aria-label="Role for Dana Ruiz" class="w-36" defaultSelectedKey="owner">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="owner" textValue="Owner">
                  Owner
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="editor" textValue="Editor">
                  Editor
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="viewer" textValue="Viewer">
                  Viewer
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={User} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Ola Nowak</ItemCard.Title>
          <ItemCard.Description>ola@example.com</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Select aria-label="Role for Ola Nowak" class="w-36" defaultSelectedKey="editor">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="owner" textValue="Owner">
                  Owner
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="editor" textValue="Editor">
                  Editor
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="viewer" textValue="Viewer">
                  Viewer
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </ItemCard.Action>
      </ItemCard>
      <ItemCard>
        <ItemCard.Icon>
          <Icon icon={User} size={18} />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Kim Lee</ItemCard.Title>
          <ItemCard.Description>kim@example.com</ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <Select aria-label="Role for Kim Lee" class="w-36" defaultSelectedKey="viewer">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="owner" textValue="Owner">
                  Owner
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="editor" textValue="Editor">
                  Editor
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="viewer" textValue="Viewer">
                  Viewer
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </ItemCard.Action>
      </ItemCard>
    </ItemCardGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <PermissionLevels />
    </div>
  );
}
