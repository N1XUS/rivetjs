// Concentric radii (identity spec §3.1, TWEAKS.md TW-123): nests the visual routes do not cover — a Card in a Card, a
// `data-radius="concentric"` Button in a Card corner, a Card in a Popover dialog and in a Modal dialog. Read by
// `geometry.test.ts` (child radius = max(parent radius − inset, --r-min)).
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Modal } from "@rivetjs/ui/modal";
import { Popover } from "@rivetjs/ui/popover";

export default function GeometryStories() {
  return (
    <section class="flex flex-wrap items-start gap-8 p-10">
      <Card id="g-outer" class="w-[320px]">
        <Card.Content>
          <Card id="g-nested" variant="secondary">
            <p>Nested</p>
          </Card>
        </Card.Content>
      </Card>
      <Card id="g-corner" class="w-[320px]">
        <Button id="g-concentric" data-radius="concentric">
          Corner
        </Button>
        <Button id="g-pill">Pill</Button>
      </Card>
      <Popover>
        <Button id="g-po-trigger">Popover</Button>
        <Popover.Content class="max-w-80" dialog={false}>
          <Popover.Dialog id="g-po-dialog">
            <Card id="g-po-card" variant="secondary">
              <p>In a popover</p>
            </Card>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <Modal>
        <Button id="g-mo-trigger">Modal</Button>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog id="g-mo-dialog">
              <Card id="g-mo-card" variant="secondary">
                <p>In a modal</p>
              </Card>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
