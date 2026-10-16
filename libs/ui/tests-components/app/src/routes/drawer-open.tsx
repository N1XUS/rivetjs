// Drawer open in the server HTML (`defaultOpen`): `#dro-dialog` with `#dro-handle`; drag-to-dismiss must work on the resumed
// page before any other interaction (client effect attached at idle).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export default function DrawerOpenStories() {
  return (
    <section class="p-10">
      <Drawer defaultOpen>
        <Button id="dro-trigger">Open Drawer</Button>
        <Drawer.Backdrop>
          <Drawer.Container>
            <Drawer.Dialog id="dro-dialog">
              <Drawer.Handle id="dro-handle" />
              <Drawer.Header>
                <Drawer.Heading>Open on load</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>Body</Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Container>
        </Drawer.Backdrop>
      </Drawer>
    </section>
  );
}
