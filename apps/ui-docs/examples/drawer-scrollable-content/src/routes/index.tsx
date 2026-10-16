// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/scrollable-content.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Drawer: Scrollable Content" };

// #region demo
export function ScrollableContent() {
  return (
    <Drawer>
      <Button variant="secondary">Terms & Conditions</Button>
      <Drawer.Content>
        <Drawer.Handle />
        <Drawer.Header>
          <Drawer.Heading>Terms & Conditions</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {Array.from({ length: 20 }).map((_, i) => (
            <p class="mb-3">
              Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis. Pellentesque sit
              amet hendrerit risus, sed porttitor quam.
            </p>
          ))}
        </Drawer.Body>
        <Drawer.Footer>
          <Button slot="close" variant="secondary">
            Decline
          </Button>
          <Button slot="close">Accept</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ScrollableContent />
    </div>
  );
}
