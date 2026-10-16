// Server-target suite: `Modal` SSR (upstream modal.ssr.test.tsx: closed + defaultOpen render without errors) — closed: only the
// trigger; defaultOpen: the cdk overlay renders the modal in the server HTML (resumable, deliberate cdk deviation) with the
// HeroUI classes and data-slots; `Modal.Trigger` markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button, Drawer, Modal, Sheet } from "../index.ts";

const ModalFixture = (props: { defaultOpen?: boolean }) => (
  <Modal defaultOpen={props.defaultOpen}>
    <Button>Open modal</Button>
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Welcome</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p>Modal body content</p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close">Continue</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

test("modal SSR: closed renders the trigger only", async () => {
  const html = await renderToString(() => <ModalFixture />);
  assert.match(html, />Open modal</);
  assert.doesNotMatch(html, /modal__dialog/);
  assert.doesNotMatch(html, /Modal body content/);
});

test("modal SSR: defaultOpen renders the modal with HeroUI classes + data-slots", async () => {
  const html = await renderToString(() => <ModalFixture defaultOpen />);
  assert.match(html, /class="modal__backdrop modal__backdrop--opaque"/);
  assert.match(html, /data-slot="modal-backdrop"/);
  assert.match(html, /class="modal__container"[^>]*data-placement="auto"|data-placement="auto"[^>]*class="modal__container"/);
  assert.match(html, /<section[^>]*data-slot="modal-dialog"/);
  assert.match(html, /class="modal__dialog modal__dialog--scroll-inside modal__dialog--md"/);
  assert.match(html, /class="modal__heading"[^>]*>Welcome</);
  assert.match(html, /data-slot="modal-close-trigger"/);
  assert.match(html, /class="modal__body modal__body--scroll-inside"/);
  assert.match(html, /Modal body content/);
});

test("modal SSR: Modal.Trigger is a div role=button with the trigger slot class", async () => {
  const html = await renderToString(() => (
    <Modal>
      <Modal.Trigger aria-label="Settings">x</Modal.Trigger>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>y</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ));
  assert.match(html, /<div[^>]*class="modal__trigger"/);
  assert.match(html, /data-slot="modal-trigger"/);
  assert.match(html, /role="button"/);
});

test("modal SSR: Modal.Content = the compound form's markup", async () => {
  const mask = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-rv-focus-scope)="[^"]*"/g, "");
  const compound = await renderToString(() => <ModalFixture defaultOpen />);
  const content = await renderToString(() => (
    <Modal defaultOpen>
      <Button>Open modal</Button>
      <Modal.Content>
        <Modal.Header>Welcome</Modal.Header>
        <Modal.Body>
          <p>Modal body content</p>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close">Continue</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  ));
  assert.equal(mask(content), mask(compound));
});

// RA mergeIds: a Dialog `id` replaces the trigger's generated overlay id. Server-open overlays: the trigger renders first,
// so DialogTrigger probes for the Dialog's id before writing `aria-controls` (CDK-PINS 2026-10-12, resume fuzz
// `/drawer-open` / `/sheet-open`). Without an own id it names the generated one.
test("open overlay SSR: the trigger's aria-controls names the rendered dialog (own id or generated)", async () => {
  const controls = (html: string) => {
    const target = / aria-controls="([^"]+)"/.exec(html)?.[1];
    assert.ok(target, html);
    assert.match(html, new RegExp(`<[a-z]+[^>]* id="${target}"[^>]* role="dialog"|<[a-z]+[^>]* role="dialog"[^>]* id="${target}"`), html);
    return target;
  };
  assert.equal(controls(await renderToString(() => <ModalFixture defaultOpen />)).startsWith("rv"), true);
  const modal = await renderToString(() => (
    <Modal defaultOpen>
      <Button>Open</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog id="own-modal">
            <Modal.Heading>T</Modal.Heading>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ));
  assert.equal(controls(modal), "own-modal");
  const drawer = await renderToString(() => (
    <Drawer defaultOpen>
      <Button>Open</Button>
      <Drawer.Backdrop>
        <Drawer.Container>
          <Drawer.Dialog id="own-drawer">
            <Drawer.Heading>T</Drawer.Heading>
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  ));
  assert.equal(controls(drawer), "own-drawer");
  const sheet = await renderToString(() => (
    <Sheet defaultOpen>
      <Sheet.Trigger>Open</Sheet.Trigger>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog id="own-sheet">
            <Sheet.Heading>T</Sheet.Heading>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  ));
  assert.equal(controls(sheet), "own-sheet");
});
