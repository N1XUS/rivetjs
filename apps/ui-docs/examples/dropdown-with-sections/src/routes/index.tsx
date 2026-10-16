// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/with-sections.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { EllipsisVertical, Pencil, SquarePlus, Trash2 } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Header } from "@rivetjs/ui/header";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Dropdown: With Sections" };

// #region demo
export function WithSections() {
  return (
    <Dropdown>
      <Button isIconOnly aria-label="Menu" variant="secondary">
        <Icon icon={EllipsisVertical} size={16} class="outline-none" />
      </Button>
      <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
        <Dropdown.Section>
          <Header>Actions</Header>
          <Dropdown.Item id="new-file" icon={SquarePlus} description="Create a new file" shortcut="command+N">
            New file
          </Dropdown.Item>
          <Dropdown.Item id="edit-file" icon={Pencil} description="Make changes" shortcut="command+E">
            Edit file
          </Dropdown.Item>
        </Dropdown.Section>
        <Separator />
        <Dropdown.Section>
          <Header>Danger zone</Header>
          <Dropdown.Item id="delete-file" variant="danger" icon={Trash2} description="Move to trash" shortcut="command+shift+D">
            Delete file
          </Dropdown.Item>
        </Dropdown.Section>
      </Dropdown.Menu>
    </Dropdown>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithSections />
    </div>
  );
}
