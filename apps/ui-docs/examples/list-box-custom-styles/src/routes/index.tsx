// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/list-box/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarGreenImage from "../assets/avatar-green.jpg?image";

export const head = { title: "ListBox: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <ListBox aria-label="Assignee" class="w-56 rounded-xl border border-border/80 bg-surface p-1 shadow-sm" selectionMode="single">
      <ListBox.Item class="rounded-lg data-[focused=true]:bg-accent/10 data-[selected=true]:bg-accent/5" id="1" textValue="Bob">
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
      <ListBox.Item class="rounded-lg data-[focused=true]:bg-accent/10 data-[selected=true]:bg-accent/5" id="2" textValue="Fred">
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
    </ListBox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
