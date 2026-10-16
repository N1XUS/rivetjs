// DOM-target suite: `AlertDialog` (upstream tests/components/alert-dialog/alert-dialog.test.tsx ported to happy-dom): role
// `alertdialog` + compound slots, CloseTrigger closes, Escape blocked by default, Escape dismisses with
// `isKeyboardDismissDisabled={false}`. Rivet: classes per variant (backdrop `variant`, container `size`, icon `status` +
// default lucide icon), placement on container + dialog, `AlertDialog.Trigger`, parts outside an `AlertDialog`, index exports.
// Focus trap / scroll lock / focus restore on a real browser: `tests-components/alert-dialog.test.ts` (upstream
// alert-dialog.browser.test.tsx).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Button } = await import("../src/components/button/index.ts");
const { AlertDialog, AlertDialogRoot, alertDialogVariants } = await import("../src/components/alert-dialog/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const dialog = () => document.querySelector("[role=alertdialog]") as HTMLElement | null;
const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null;
const escape = (target: Element) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );

type FixtureProps = { defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; isDismissable?: boolean; isKeyboardDismissDisabled?: boolean };

const AlertDialogFixture = (props: FixtureProps) => (
  <AlertDialog defaultOpen={props.defaultOpen} onOpenChange={props.onOpenChange}>
    <Button>Delete Project</Button>
    <AlertDialog.Backdrop isDismissable={props.isDismissable} isKeyboardDismissDisabled={props.isKeyboardDismissDisabled}>
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
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            <Button slot="close" variant="danger">
              Delete Project
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>
);

test("alert-dialog: index exports", () => {
  assert.equal(AlertDialog, AlertDialogRoot);
  assert.equal(AlertDialog.Root, AlertDialogRoot);
  assert.equal(alertDialogVariants().dialog(), "alert-dialog__dialog alert-dialog__dialog--md");
});

test("alert-dialog: exposes alertdialog role and compound slots; CloseTrigger closes", async () => {
  const r = render(() => <AlertDialogFixture />);
  assert.equal(dialog(), null);
  r.container.querySelector("button")!.click();
  await flush();
  const d = dialog();
  assert.ok(d);
  assert.equal(d.getAttribute("data-slot"), "alert-dialog-dialog");
  for (const name of [
    "alert-dialog-backdrop",
    "alert-dialog-container",
    "alert-dialog-header",
    "alert-dialog-body",
    "alert-dialog-footer",
    "alert-dialog-icon",
  ])
    assert.ok(slot(name), name);
  const h = slot("alert-dialog-heading")!;
  assert.match(h.tagName, /^H[1-6]$/);
  assert.equal(h.textContent, "Delete project permanently?");
  assert.equal(d.getAttribute("aria-labelledby"), h.id);
  slot("alert-dialog-close-trigger")!.click();
  await flush();
  await flush();
  assert.equal(dialog(), null);
  r.unmount();
});

test("alert-dialog: Escape blocked by default", async () => {
  const calls: boolean[] = [];
  const r = render(() => <AlertDialogFixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  assert.ok(dialog());
  escape(dialog()!);
  await flush();
  assert.ok(dialog());
  assert.deepEqual(calls, []);
  r.unmount();
});

test("alert-dialog: closing via CloseTrigger", async () => {
  const calls: boolean[] = [];
  const r = render(() => <AlertDialogFixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  slot("alert-dialog-close-trigger")!.click();
  await flush();
  await flush();
  assert.deepEqual(calls, [false]);
  assert.equal(dialog(), null);
  r.unmount();
});

test("alert-dialog: Escape dismisses when keyboard dismiss is enabled", async () => {
  const calls: boolean[] = [];
  const r = render(() => <AlertDialogFixture defaultOpen onOpenChange={(o) => calls.push(o)} isKeyboardDismissDisabled={false} />);
  await flush();
  assert.ok(dialog());
  escape(dialog()!);
  await flush();
  await flush();
  assert.deepEqual(calls, [false]);
  assert.equal(dialog(), null);
  r.unmount();
});

test("alert-dialog: controlled Backdrop without a root (two-way signal); Container provides the slots", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const isOpen = signal(false);
  const r = render(() => (
    <AlertDialog.Backdrop isOpen={isOpen}>
      <AlertDialog.Container>
        <AlertDialog.Dialog aria-label="Controlled">
          <AlertDialog.Header>x</AlertDialog.Header>
          <AlertDialog.CloseTrigger />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  ));
  isOpen.set(true);
  await flush();
  assert.ok(dialog());
  // upstream: Backdrop / Container provide the full slots, also without an AlertDialog root
  assert.match(dialog()!.className, /\balert-dialog__dialog\b/);
  assert.equal(slot("alert-dialog-header")!.className, "alert-dialog__header");
  slot("alert-dialog-close-trigger")!.click();
  await flush();
  await flush();
  assert.equal(isOpen(), false);
  assert.equal(dialog(), null);
  r.unmount();
});

test("alert-dialog: default classes (opaque backdrop, md, danger icon + lucide default icon, placement auto)", async () => {
  const r = render(() => <AlertDialogFixture defaultOpen />);
  await flush();
  assert.match(slot("alert-dialog-backdrop")!.className, /^alert-dialog__backdrop alert-dialog__backdrop--opaque/);
  assert.equal(slot("alert-dialog-container")!.className, "alert-dialog__container");
  assert.equal(slot("alert-dialog-container")!.getAttribute("data-placement"), "auto");
  assert.equal(dialog()!.className, "alert-dialog__dialog alert-dialog__dialog--md");
  assert.equal(dialog()!.getAttribute("data-placement"), "auto");
  const icon = slot("alert-dialog-icon")!;
  assert.equal(icon.className, "alert-dialog__icon alert-dialog__icon--danger");
  const glyph = icon.querySelector("[data-slot=alert-dialog-default-icon]")!;
  assert.equal(glyph.tagName.toLowerCase(), "svg");
  r.unmount();
});

test("alert-dialog: variant / size / placement / status + class on every part", async () => {
  const r = render(() => (
    <AlertDialog defaultOpen>
      <Button>Open</Button>
      <AlertDialog.Backdrop variant="blur" class="bd">
        <AlertDialog.Container placement="top" size="lg" class="ct">
          <AlertDialog.Dialog class="dl">
            <AlertDialog.CloseTrigger class="cl" />
            <AlertDialog.Header class="hd">
              <AlertDialog.Icon status="success" class="ic">
                <span id="custom-icon" />
              </AlertDialog.Icon>
              <AlertDialog.Heading class="hg">T</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body class="bo">b</AlertDialog.Body>
            <AlertDialog.Footer class="ft">f</AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  ));
  await flush();
  assert.match(slot("alert-dialog-backdrop")!.className, /^alert-dialog__backdrop alert-dialog__backdrop--blur bd$/);
  assert.equal(slot("alert-dialog-container")!.className, "alert-dialog__container ct");
  assert.equal(slot("alert-dialog-container")!.getAttribute("data-placement"), "top");
  assert.equal(dialog()!.className, "alert-dialog__dialog alert-dialog__dialog--lg dl");
  assert.equal(dialog()!.getAttribute("data-placement"), "top");
  assert.equal(slot("alert-dialog-icon")!.className, "alert-dialog__icon alert-dialog__icon--success ic");
  assert.ok(slot("alert-dialog-icon")!.querySelector("#custom-icon"));
  assert.equal(slot("alert-dialog-icon")!.querySelector("[data-slot=alert-dialog-default-icon]"), null);
  assert.equal(slot("alert-dialog-header")!.className, "alert-dialog__header hd");
  assert.equal(slot("alert-dialog-heading")!.className, "alert-dialog__heading hg");
  assert.equal(slot("alert-dialog-body")!.className, "alert-dialog__body bo");
  assert.equal(slot("alert-dialog-footer")!.className, "alert-dialog__footer ft");
  assert.match(slot("alert-dialog-close-trigger")!.className, /alert-dialog__close-trigger cl$/);
  r.unmount();
});

test("alert-dialog: AlertDialog.Trigger is a pressable div (role=button, alert-dialog__trigger) that opens the dialog", async () => {
  const r = render(() => (
    <AlertDialog>
      <AlertDialog.Trigger class="extra">Delete</AlertDialog.Trigger>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog aria-label="Confirm">x</AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  ));
  const t = r.container.querySelector("[data-slot=alert-dialog-trigger]") as HTMLElement;
  assert.equal(t.tagName, "DIV");
  assert.equal(t.getAttribute("role"), "button");
  assert.equal(t.className, "alert-dialog__trigger extra");
  t.click();
  await flush();
  assert.ok(dialog());
  r.unmount();
});

test("alert-dialog: parts outside an AlertDialog get only the caller's class; Icon keeps its status slot", () => {
  const r = render(() => (
    <div>
      <AlertDialog.Header class="x">h</AlertDialog.Header>
      <AlertDialog.Icon status="warning" />
    </div>
  ));
  assert.equal(r.container.querySelector("[data-slot=alert-dialog-header]")!.className, "x");
  assert.equal(r.container.querySelector("[data-slot=alert-dialog-icon]")!.className, "alert-dialog__icon alert-dialog__icon--warning");
  r.unmount();
});
