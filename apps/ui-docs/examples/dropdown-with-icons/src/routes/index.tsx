// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/with-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { FolderOpen, Save, SquarePlus, Trash2 } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export const head = { title: "Dropdown: With Icons" };

// #region demo
export function WithIcons() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
        <Dropdown.Item id="new-file" icon={SquarePlus} shortcut="command+N">
          New file
        </Dropdown.Item>
        <Dropdown.Item id="open-file" icon={FolderOpen} shortcut="command+O">
          Open file
        </Dropdown.Item>
        <Dropdown.Item id="save-file" icon={Save} shortcut="command+S">
          Save file
        </Dropdown.Item>
        <Dropdown.Item id="delete-file" variant="danger" icon={Trash2} shortcut="command+shift+D">
          Delete file
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIcons />
    </div>
  );
}
