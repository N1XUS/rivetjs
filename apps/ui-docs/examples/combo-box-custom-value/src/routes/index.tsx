// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/custom-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarOrangeImage from "../assets/avatar-orange.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";

export const head = { title: "ComboBox: Custom Value" };

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
    <ComboBox class="w-[256px]">
      <Label>User</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Search users..." />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
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
      </ComboBox.Popover>
    </ComboBox>
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
