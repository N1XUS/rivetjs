// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/list-box/with-disabled-items.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Pencil, SquarePlus, Trash2 } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { Header } from "@rivetjs/ui/header";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Separator } from "@rivetjs/ui/separator";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "ListBox: With Disabled Items" };

// #region demo
export function WithDisabledItems() {
  return (
    <Surface class="w-[256px] rounded-3xl shadow-surface">
      <ListBox
        aria-label="File actions"
        class="w-full p-2"
        disabledKeys={["delete-file"]}
        selectionMode="none"
        onAction={(key) => alert(`Selected item: ${key}`)}
      >
        <ListBox.Section>
          <Header>Actions</Header>
          <ListBox.Item id="new-file" textValue="New file">
            <div class="flex h-8 items-start justify-center pt-px">
              <Icon icon={SquarePlus} size={16} class="size-4 shrink-0 text-muted" />
            </div>
            <div class="flex flex-col">
              <Label>New file</Label>
              <Description>Create a new file</Description>
            </div>
            <Kbd class="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>N</Kbd.Content>
            </Kbd>
          </ListBox.Item>
          <ListBox.Item id="edit-file" textValue="Edit file">
            <div class="flex h-8 items-start justify-center pt-px">
              <Icon icon={Pencil} size={16} class="size-4 shrink-0 text-muted" />
            </div>
            <div class="flex flex-col">
              <Label>Edit file</Label>
              <Description>Make changes</Description>
            </div>
            <Kbd class="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>E</Kbd.Content>
            </Kbd>
          </ListBox.Item>
        </ListBox.Section>
        <Separator />
        <ListBox.Section>
          <Header>Danger zone</Header>
          <ListBox.Item id="delete-file" textValue="Delete file" variant="danger">
            <div class="flex h-8 items-start justify-center pt-px">
              <Icon icon={Trash2} size={16} class="size-4 shrink-0 text-danger" />
            </div>
            <div class="flex flex-col">
              <Label>Delete file</Label>
              <Description>Move to trash</Description>
            </div>
            <Kbd class="ms-auto" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Abbr keyValue="shift" />
              <Kbd.Content>D</Kbd.Content>
            </Kbd>
          </ListBox.Item>
        </ListBox.Section>
      </ListBox>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDisabledItems />
    </div>
  );
}
