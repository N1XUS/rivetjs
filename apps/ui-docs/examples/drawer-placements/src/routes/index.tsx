// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/placements.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Drawer: Placement" };

// #region demo
export function Placements() {
  const placements = ["bottom", "top", "left", "right"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {placements.map((placement) => (
        <Drawer placement={placement}>
          <Button variant="secondary">{placement.charAt(0).toUpperCase() + placement.slice(1)}</Button>
          <Drawer.Content>
            {placement === "bottom" && <Drawer.Handle />}
            <Drawer.Header>
              <Drawer.Heading>{placement.charAt(0).toUpperCase() + placement.slice(1)} Drawer</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <p>
                This drawer slides in from the <strong>{placement}</strong> edge of the screen.
              </p>
            </Drawer.Body>
            <Drawer.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button slot="close">Done</Button>
            </Drawer.Footer>
            {placement === "top" && <Drawer.Handle />}
          </Drawer.Content>
        </Drawer>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Placements />
    </div>
  );
}
