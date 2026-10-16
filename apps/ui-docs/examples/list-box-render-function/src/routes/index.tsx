// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/list-box/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";
import avatarPurpleImage from "../assets/avatar-purple.jpg?image";

export const head = { title: "ListBox: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <ListBox aria-label="Users" class="w-[220px]" render={(props) => <div {...props} data-custom="true" />} selectionMode="single">
      <ListBox.Item id="1" render={(props) => <div {...props} data-custom="foo" />} textValue="Bob">
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
      <ListBox.Item id="2" render={(props) => <div {...props} data-custom="bar" />} textValue="Fred">
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
      <ListBox.Item id="3" render={(props) => <div {...props} data-custom="baz" />} textValue="Martha">
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
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
