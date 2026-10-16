// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/with-keyboard-shortcuts.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export const head = { title: "Dropdown: With Keyboard Shortcuts" };

// #region demo
export function WithKeyboardShortcuts() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
        <Dropdown.Item id="new" shortcut="command+N">
          New
        </Dropdown.Item>
        <Dropdown.Item id="open" shortcut="command+O">
          Open
        </Dropdown.Item>
        <Dropdown.Item id="save" shortcut="command+S">
          Save
        </Dropdown.Item>
        <Dropdown.Item id="delete" variant="danger" shortcut="command+shift+D">
          Delete
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithKeyboardShortcuts />
    </div>
  );
}
