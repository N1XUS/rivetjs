// Drawer on a resumed page (upstream drawer fixture + browser test): `#dr-trigger` Button opens `#dr-dialog` (bottom; handle
// `#dr-handle`, close trigger, heading, body with `#dr-inside`, footer Confirm `#dr-confirm` slot=close); `#dr-left`
// `Drawer.Trigger` opens `#dr-ldialog` (placement left, blur backdrop); `#dr-state` shows the last `onOpenChange` value.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export default function DrawerStories() {
  const last = signal("none");
  return (
    <section class="flex flex-wrap gap-8 p-10">
      <span id="dr-state">{last()}</span>
      <Drawer onOpenChange={(open: boolean) => last.set(String(open))}>
        <Button id="dr-trigger">Open Drawer</Button>
        <Drawer.Backdrop>
          <Drawer.Container>
            <Drawer.Dialog id="dr-dialog">
              <Drawer.Handle id="dr-handle" />
              <Drawer.CloseTrigger />
              <Drawer.Header>
                <Drawer.Heading>Drawer Title</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <p>Drawer body content</p>
                <Button id="dr-inside">Inside action</Button>
              </Drawer.Body>
              <Drawer.Footer>
                <Button id="dr-confirm" slot="close">
                  Confirm
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Container>
        </Drawer.Backdrop>
      </Drawer>
      <Drawer>
        <Drawer.Trigger id="dr-left">Left</Drawer.Trigger>
        <Drawer.Backdrop variant="blur">
          <Drawer.Container placement="left">
            <Drawer.Dialog id="dr-ldialog">
              <Drawer.Header id="dr-lheader">
                <Drawer.Heading>Left Drawer</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>Left body</Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Container>
        </Drawer.Backdrop>
      </Drawer>
    </section>
  );
}
