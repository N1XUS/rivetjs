// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Drawer: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Drawer placement="right">
      <Button variant="secondary">Open filters</Button>
      <Drawer.Content backdrop="blur" class="border-l border-border/80 bg-surface" closeButton={false}>
        <Drawer.Header>
          <Drawer.Heading class="text-foreground">Filters</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          <p class="text-sm text-muted">Narrow results by status, owner, or date.</p>
        </Drawer.Body>
        <Drawer.Footer>
          <Button slot="close" variant="secondary">
            Cancel
          </Button>
          <Button slot="close">Apply</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
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
