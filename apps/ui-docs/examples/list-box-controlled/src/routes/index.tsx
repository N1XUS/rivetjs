// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/list-box/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Check } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import type { Selection } from "@rivetjs/cdk/listbox";
import { Surface } from "@rivetjs/ui/surface";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";

export const head = { title: "ListBox: Controlled" };

// #region demo
export function Controlled() {
  const selected = signal<Selection>(new Set(["1"]));
  const selectedItems = () => Array.from(selected());

  return (
    <div class="space-y-4">
      <Surface class="w-[256px] rounded-3xl shadow-surface">
        <ListBox aria-label="Users" selectedKeys={selected} selectionMode="multiple">
          <ListBox.Item id="1" textValue="Bob">
            <Avatar size="sm">
              <Avatar.Image alt="Bob" src={avatarBlueImage.src} />
              <Avatar.Fallback>B</Avatar.Fallback>
            </Avatar>
            <div class="flex flex-col">
              <Label>Bob</Label>
              <Description>bob@acme.com</Description>
            </div>
            <ListBox.ItemIndicator>
              {({ isSelected }: { isSelected: () => boolean }) =>
                isSelected() ? <Icon icon={Check} size={16} class="size-4 text-accent-soft-foreground" /> : null
              }
            </ListBox.ItemIndicator>
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
            <ListBox.ItemIndicator>
              {({ isSelected }: { isSelected: () => boolean }) =>
                isSelected() ? <Icon icon={Check} size={16} class="size-4 text-accent-soft-foreground" /> : null
              }
            </ListBox.ItemIndicator>
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
            <ListBox.ItemIndicator>
              {({ isSelected }: { isSelected: () => boolean }) =>
                isSelected() ? <Icon icon={Check} size={16} class="size-4 text-accent-soft-foreground" /> : null
              }
            </ListBox.ItemIndicator>
          </ListBox.Item>
        </ListBox>
      </Surface>
      <p class="text-sm text-muted">Selected: {selectedItems().length > 0 ? selectedItems().join(", ") : "None"}</p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
