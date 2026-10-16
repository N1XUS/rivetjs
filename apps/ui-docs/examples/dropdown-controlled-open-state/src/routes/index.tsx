// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/controlled-open-state.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export const head = { title: "Dropdown: Controlled Open State" };

// #region demo
export function ControlledOpenState() {
  const open = signal(false);

  return (
    <div class="flex min-w-sm flex-col items-center justify-center gap-4">
      <p class="text-sm text-muted">
        Dropdown is: <strong>{open() ? "open" : "closed"}</strong>
      </p>
      <Dropdown isOpen={open}>
        <Button aria-label="Menu" variant="secondary">
          Actions
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
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ControlledOpenState />
    </div>
  );
}
