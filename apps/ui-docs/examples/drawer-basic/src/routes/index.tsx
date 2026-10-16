// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Drawer: Usage" };

// #region demo
export function Basic() {
  return (
    <Drawer placement="right">
      <Button variant="secondary">Open Drawer</Button>
      <Drawer.Content closeButton={false}>
        <Drawer.Header>
          <Drawer.Heading>Drawer Title</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          <p>This is a bottom drawer built with React Aria's Modal component. It slides up from the bottom of the screen with a smooth CSS transition.</p>
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
      <Basic />
    </div>
  );
}
