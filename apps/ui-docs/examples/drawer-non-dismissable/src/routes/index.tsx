// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/non-dismissable.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Drawer: Non-Dismissable" };

// #region demo
export function NonDismissable() {
  return (
    <Drawer>
      <Button variant="secondary">Important Action</Button>
      <Drawer.Content isDismissable={false} closeButton={false}>
        <Drawer.Header>
          <Drawer.Heading>Confirm Action</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          <p>This drawer cannot be dismissed by clicking outside or dragging. You must use one of the buttons below.</p>
        </Drawer.Body>
        <Drawer.Footer>
          <Button slot="close" variant="secondary">
            Cancel
          </Button>
          <Button slot="close">Confirm</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <NonDismissable />
    </div>
  );
}
