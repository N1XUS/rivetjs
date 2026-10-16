// Server-target suite: `Drawer` SSR (upstream drawer.ssr.test.tsx: closed + defaultOpen render without errors) — closed: only the
// trigger; defaultOpen: the cdk overlay renders the drawer in the server HTML (resumable, deliberate cdk deviation) with the
// HeroUI classes, data-slots, `data-placement` and the dialog / body inline `touch-action`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button, Drawer } from "../index.ts";

const DrawerFixture = (props: { defaultOpen?: boolean; placement?: "top" | "bottom" | "left" | "right" }) => (
  <Drawer defaultOpen={props.defaultOpen}>
    <Button>Open Drawer</Button>
    <Drawer.Backdrop>
      <Drawer.Container placement={props.placement}>
        <Drawer.Dialog>
          <Drawer.Handle />
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>Drawer Title</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            <p>Drawer body content</p>
          </Drawer.Body>
          <Drawer.Footer>
            <Button slot="close">Confirm</Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Container>
    </Drawer.Backdrop>
  </Drawer>
);

test("drawer SSR: closed renders the trigger only", async () => {
  const html = await renderToString(() => <DrawerFixture />);
  assert.match(html, />Open Drawer</);
  assert.doesNotMatch(html, /drawer__dialog/);
  assert.doesNotMatch(html, /Drawer body content/);
});

test("drawer SSR: defaultOpen renders the drawer with HeroUI classes + data-slots", async () => {
  const html = await renderToString(() => <DrawerFixture defaultOpen placement="right" />);
  assert.match(html, /class="drawer__backdrop drawer__backdrop--opaque"/);
  assert.match(html, /data-slot="drawer-backdrop"/);
  assert.match(html, /class="drawer__content drawer__content--right"/);
  assert.match(html, /data-slot="drawer-content"/);
  assert.match(html, /<section[^>]*data-slot="drawer-dialog"/);
  assert.match(html, /class="drawer__dialog drawer__dialog--right"/);
  assert.match(html, /data-placement="right"/);
  assert.match(html, /touch-action: ?none/);
  assert.match(html, /<div[^>]*aria-hidden="true"[^>]*class="drawer__handle"[^>]*><div data-slot="drawer-handle-bar"><\/div><\/div>|class="drawer__handle"/);
  assert.match(html, /data-slot="drawer-handle-bar"/);
  assert.match(html, /class="drawer__heading"[^>]*>Drawer Title</);
  assert.match(html, /data-slot="drawer-close-trigger"/);
  assert.match(html, /class="drawer__body"[^>]*style="touch-action: ?pan-y;?"|style="touch-action: ?pan-y;?"[^>]*class="drawer__body"/);
  assert.match(html, /Drawer body content/);
});

test("drawer SSR: Drawer.Trigger is a button with the trigger slot class", async () => {
  const html = await renderToString(() => (
    <Drawer>
      <Drawer.Trigger>Open</Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Container>
          <Drawer.Dialog>y</Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  ));
  assert.match(html, /<button[^>]*class="drawer__trigger"/);
  assert.match(html, /data-slot="drawer-trigger"/);
});

test("drawer SSR: Drawer.Content + root placement = the explicit parts' markup", async () => {
  const mask = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-rv-focus-scope)="[^"]*"/g, "");
  const explicit = await renderToString(() => (
    <Drawer defaultOpen>
      <Button>Open</Button>
      <Drawer.Backdrop>
        <Drawer.Container placement="right">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>Cart</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>Items</Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  ));
  const folded = await renderToString(() => (
    <Drawer defaultOpen placement="right">
      <Button>Open</Button>
      <Drawer.Content>
        <Drawer.Header>Cart</Drawer.Header>
        <Drawer.Body>Items</Drawer.Body>
      </Drawer.Content>
    </Drawer>
  ));
  assert.match(explicit, /drawer__content--right/);
  assert.equal(mask(folded), mask(explicit));
});
