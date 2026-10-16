// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/list-box/multi-select.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Surface } from "@rivetjs/ui/surface";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";

export const head = { title: "ListBox: Multi Select" };

// #region demo
export function MultiSelect() {
  return (
    <Surface class="w-[256px] rounded-3xl shadow-surface">
      <ListBox aria-label="Users" selectionMode="multiple">
        <ListBox.Item id="1" textValue="Bob">
          <Avatar size="sm">
            <Avatar.Image alt="Bob" src={avatarBlueImage.src} />
            <Avatar.Fallback>B</Avatar.Fallback>
          </Avatar>
          <div class="flex flex-col">
            <Label>Bob</Label>
            <Description>bob@acme.com</Description>
          </div>
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="2" textValue="Fred">
          <Avatar size="sm">
            <Avatar.Image alt="Fred" src={avatarGreenImage.src} />
            <Avatar.Fallback>F</Avatar.Fallback>
          </Avatar>
          <div class="flex flex-col">
            <Label>Fred</Label>
            <Description>fred@acme.com</Description>
          </div>
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="3" textValue="Martha">
          <Avatar size="sm">
            <Avatar.Image alt="Martha" src={avatarPurpleImage.src} />
            <Avatar.Fallback>M</Avatar.Fallback>
          </Avatar>
          <div class="flex flex-col">
            <Label>Martha</Label>
            <Description>martha@acme.com</Description>
          </div>
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MultiSelect />
    </div>
  );
}
