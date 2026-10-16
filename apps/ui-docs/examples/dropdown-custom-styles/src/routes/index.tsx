// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";

export const head = { title: "Dropdown: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Dropdown>
      <Button variant="secondary">Actions</Button>
      <Dropdown.Popover class="rounded-xl border border-border/80 bg-surface p-1 shadow-sm">
        <Dropdown.Menu>
          <Dropdown.Item class="rounded-lg data-[focused=true]:bg-default" id="rename">
            Rename
          </Dropdown.Item>
          <Dropdown.Item class="rounded-lg data-[focused=true]:bg-default" id="duplicate">
            Duplicate
          </Dropdown.Item>
          <Dropdown.Item class="rounded-lg data-[focused=true]:bg-danger-soft" id="delete" variant="danger">
            Delete
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
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
