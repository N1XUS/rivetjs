// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/long-press-trigger.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export const head = { title: "Dropdown: Long Press Trigger" };

// #region demo
export function LongPressTrigger() {
  return (
    <Dropdown trigger="longPress">
      <Button aria-label="Menu" variant="secondary">
        Long Press
      </Button>
      <Dropdown.Menu>
        <Dropdown.Item id="new-file">New file</Dropdown.Item>
        <Dropdown.Item id="open-file">Open file</Dropdown.Item>
        <Dropdown.Item id="save-file">Save file</Dropdown.Item>
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
      <LongPressTrigger />
    </div>
  );
}
