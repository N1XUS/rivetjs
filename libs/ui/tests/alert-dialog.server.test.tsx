// Server-target suite: `AlertDialog` SSR (upstream alert-dialog.ssr.test.tsx: closed + defaultOpen render without errors) — closed:
// only the trigger; defaultOpen: the cdk overlay renders the alert dialog in the server HTML (resumable, deliberate cdk deviation)
// with role `alertdialog`, the HeroUI classes and data-slots and the default lucide icon.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { AlertDialog, Button } from "../index.ts";

const AlertDialogFixture = (props: { defaultOpen?: boolean }) => (
  <AlertDialog defaultOpen={props.defaultOpen}>
    <Button>Delete Project</Button>
    <AlertDialog.Backdrop>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>Delete project permanently?</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>This action cannot be undone.</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close">Delete Project</Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>
);

test("alert-dialog SSR: closed renders the trigger only", async () => {
  const html = await renderToString(() => <AlertDialogFixture />);
  assert.match(html, />Delete Project</);
  assert.doesNotMatch(html, /alert-dialog__dialog/);
  assert.doesNotMatch(html, /This action cannot be undone/);
});

test("alert-dialog SSR: defaultOpen renders the dialog with role alertdialog, HeroUI classes + data-slots", async () => {
  const html = await renderToString(() => <AlertDialogFixture defaultOpen />);
  assert.match(html, /class="alert-dialog__backdrop alert-dialog__backdrop--opaque"/);
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /data-slot="alert-dialog-dialog"/);
  assert.match(html, /class="alert-dialog__dialog alert-dialog__dialog--md"/);
  assert.match(html, /class="alert-dialog__icon alert-dialog__icon--danger"/);
  assert.match(html, /<svg[^>]*data-slot="alert-dialog-default-icon"/);
  assert.match(html, /class="alert-dialog__heading"[^>]*>Delete project permanently\?</);
  assert.match(html, /This action cannot be undone/);
});
