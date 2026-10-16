// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/with-descriptions.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { FolderOpen, Save, SquarePlus, Trash2 } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export const head = { title: "Dropdown: With Descriptions" };

// #region demo
export function WithDescriptions() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
        <Dropdown.Item id="new-file" icon={SquarePlus} description="Create a new file" shortcut="command+N">
          New file
        </Dropdown.Item>
        <Dropdown.Item id="open-file" icon={FolderOpen} description="Open an existing file" shortcut="command+O">
          Open file
        </Dropdown.Item>
        <Dropdown.Item id="save-file" icon={Save} description="Save the current file" shortcut="command+S">
          Save file
        </Dropdown.Item>
        <Dropdown.Item id="delete-file" variant="danger" icon={Trash2} description="Move to trash" shortcut="command+shift+D">
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
      <WithDescriptions />
    </div>
  );
}
