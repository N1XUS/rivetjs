// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export const head = { title: "Dropdown: Usage" };

// #region demo
export function Default() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Actions
      </Button>
      <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
        <Dropdown.Item id="new-file">New file</Dropdown.Item>
        <Dropdown.Item id="copy-link">Copy link</Dropdown.Item>
        <Dropdown.Item id="edit-file">Edit file</Dropdown.Item>
        <Dropdown.Item id="delete-file" variant="danger">
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
      <Default />
    </div>
  );
}
