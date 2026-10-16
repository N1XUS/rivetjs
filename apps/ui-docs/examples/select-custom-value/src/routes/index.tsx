// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/custom-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { selectedKeys } from "@rivetjs/cdk/select";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "Select: Custom Value" };

// #region demo
export function CustomValue() {
  const users = [
    {
      avatarUrl: avatarBlueImage.src,
      email: "bob@acme.com",
      fallback: "B",
      id: "1",
      name: "Bob",
    },
    {
      avatarUrl: avatarGreenImage.src,
      email: "fred@acme.com",
      fallback: "F",
      id: "2",
      name: "Fred",
    },
    {
      avatarUrl: avatarPurpleImage.src,
      email: "martha@acme.com",
      fallback: "M",
      id: "3",
      name: "Martha",
    },
    {
      avatarUrl: avatarRedImage.src,
      email: "john@acme.com",
      fallback: "J",
      id: "4",
      name: "John",
    },
    {
      avatarUrl: avatarOrangeImage.src,
      email: "jane@acme.com",
      fallback: "J",
      id: "5",
      name: "Jane",
    },
  ];

  return (
    <Select class="w-[256px]" placeholder="Select a user">
      <Label>User</Label>
      <Select.Trigger>
        <Select.Value>
          {({ defaultChildren, isPlaceholder, state }) => {
            const keys = selectedKeys(state);

            if (isPlaceholder() || keys.length === 0) {
              return defaultChildren;
            }

            if (keys.length > 1) {
              return `${keys.length} users selected`;
            }

            const selectedItem = users.find((user) => user.id === keys[0]);

            if (!selectedItem) {
              return defaultChildren;
            }

            return (
              <div class="flex items-center gap-2">
                <Avatar class="size-4" size="sm">
                  <Avatar.Image src={selectedItem.avatarUrl} />
                  <Avatar.Fallback>{selectedItem.fallback}</Avatar.Fallback>
                </Avatar>
                <span>{selectedItem.name}</span>
              </div>
            );
          }}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {users.map((user) => (
            <ListBox.Item id={user.id} textValue={user.name}>
              <Avatar size="sm">
                <Avatar.Image src={user.avatarUrl} />
                <Avatar.Fallback>{user.fallback}</Avatar.Fallback>
              </Avatar>
              <div class="flex flex-col">
                <Label>{user.name}</Label>
                <Description>{user.email}</Description>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomValue />
    </div>
  );
}
