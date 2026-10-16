// DOM-target suite: `Modal` (upstream tests/components/modal/modal.test.tsx ported to happy-dom): open via the trigger exposes the
// compound slots (`data-slot` modal-backdrop / -container / -dialog / -header / -body / -footer, `modal__dialog`), heading,
// close; Escape dismiss + `onOpenChange(false)`; `Modal.CloseTrigger` closes. Rivet: classes per variant (backdrop `variant`,
// container `scroll` / `size` reaching the dialog / body slots, `placement` on container + dialog), `SurfaceContext` inside the
// dialog, `Modal.Trigger`, `useOverlayState` + `state` prop, parts outside a `Modal`, index exports, `Modal.Content` (= the explicit
// parts' markup; Header string → Heading; `closeButton={false}`; overlay props). Focus trap / scroll lock /
// focus restore on a real browser: `tests-components/modal.test.ts` (upstream modal.browser.test.tsx).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { useContext } = await import("@rivetjs/reactivity");
const { Button } = await import("../src/components/button/index.ts");
const { Modal, ModalRoot, ModalBackdrop, modalVariants } = await import("../src/components/modal/index.ts");
const { useOverlayState } = await import("../src/hooks/use-overlay-state.tsx");
const { SurfaceContext } = await import("../src/components/surface/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const dialog = () => document.querySelector("[role=dialog]") as HTMLElement | null;
const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null;
const escape = (target: Element) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );

const ModalFixture = (props: { defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }) => (
  <Modal defaultOpen={props.defaultOpen} onOpenChange={props.onOpenChange}>
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
            <Button>Inside action</Button>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close">Continue</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

test("modal: index exports", () => {
  assert.equal(Modal, ModalRoot);
  assert.equal(Modal.Root, ModalRoot);
  assert.equal(Modal.Backdrop, ModalBackdrop);
  assert.equal(modalVariants().dialog(), "modal__dialog modal__dialog--scroll-inside modal__dialog--md");
});

test("modal: exposes compound slots; Continue (slot=close) closes", async () => {
  const r = render(() => <ModalFixture />);
  assert.equal(dialog(), null);
  r.container.querySelector("button")!.click();
  await flush();
  const d = dialog();
  assert.ok(d);
  assert.equal(d.getAttribute("data-slot"), "modal-dialog");
  assert.match(d.className, /modal__dialog/);
  for (const name of ["modal-backdrop", "modal-container", "modal-header", "modal-body", "modal-footer", "modal-close-trigger"]) assert.ok(slot(name), name);
  const h = document.querySelector("[data-slot=modal-heading]") as HTMLElement;
  assert.match(h.tagName, /^H[1-6]$/);
  assert.equal(h.textContent, "Welcome");
  assert.equal(d.getAttribute("aria-labelledby"), h.id);
  const cont = [...d.querySelectorAll("button")].find((b) => b.textContent === "Continue")!;
  cont.click();
  await flush();
  await flush();
  assert.equal(dialog(), null);
  r.unmount();
});

test("modal: Escape dismisses (onOpenChange false)", async () => {
  const calls: boolean[] = [];
  const r = render(() => <ModalFixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  assert.ok(dialog());
  escape(dialog()!);
  await flush();
  assert.deepEqual(calls, [false]);
  await flush();
  assert.equal(dialog(), null);
  r.unmount();
});

test("modal: closing via CloseTrigger", async () => {
  const calls: boolean[] = [];
  const r = render(() => <ModalFixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  const close = slot("modal-close-trigger")!;
  assert.equal(close.getAttribute("aria-label"), "Close");
  assert.match(close.className, /modal__close-trigger/);
  close.click();
  await flush();
  assert.deepEqual(calls, [false]);
  r.unmount();
});

test("modal: default classes (opaque backdrop, scroll inside, md, placement auto) + SurfaceContext default", async () => {
  let surface: unknown;
  const Probe = () => {
    surface = useContext(SurfaceContext).variant;
    return null;
  };
  const r = render(() => (
    <Modal defaultOpen>
      <Button>Open</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Body>
              <Probe />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ));
  await flush();
  assert.match(slot("modal-backdrop")!.className, /^modal__backdrop modal__backdrop--opaque/);
  assert.equal(slot("modal-container")!.className, "modal__container");
  assert.equal(slot("modal-container")!.getAttribute("data-placement"), "auto");
  assert.equal(dialog()!.className, "modal__dialog modal__dialog--scroll-inside modal__dialog--md");
  assert.equal(dialog()!.getAttribute("data-placement"), "auto");
  assert.equal(slot("modal-body")!.className, "modal__body modal__body--scroll-inside");
  assert.equal(surface, "default");
  r.unmount();
});

test("modal: variant / scroll / size / placement + class on every part", async () => {
  const r = render(() => (
    <Modal defaultOpen>
      <Button>Open</Button>
      <Modal.Backdrop variant="blur" class="bd">
        <Modal.Container placement="top" scroll="outside" size="lg" class="ct">
          <Modal.Dialog class="dl">
            <Modal.CloseTrigger class="cl" />
            <Modal.Header class="hd">
              <Modal.Icon class="ic">i</Modal.Icon>
              <Modal.Heading class="hg">T</Modal.Heading>
            </Modal.Header>
            <Modal.Body class="bo">b</Modal.Body>
            <Modal.Footer class="ft">f</Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ));
  await flush();
  assert.match(slot("modal-backdrop")!.className, /^modal__backdrop modal__backdrop--blur bd$/);
  assert.equal(slot("modal-container")!.className, "modal__container modal__container--scroll-outside ct");
  assert.equal(slot("modal-container")!.getAttribute("data-placement"), "top");
  assert.equal(dialog()!.className, "modal__dialog modal__dialog--scroll-outside modal__dialog--lg dl");
  assert.equal(dialog()!.getAttribute("data-placement"), "top");
  assert.equal(slot("modal-body")!.className, "modal__body modal__body--scroll-outside bo");
  assert.equal(slot("modal-header")!.className, "modal__header hd");
  assert.equal(slot("modal-icon")!.className, "modal__icon ic");
  assert.equal(slot("modal-heading")!.className, "modal__heading hg");
  assert.equal(slot("modal-footer")!.className, "modal__footer ft");
  assert.match(slot("modal-close-trigger")!.className, /modal__close-trigger cl$/);
  r.unmount();
});

test("modal: Modal.Trigger is a pressable div (role=button, modal__trigger) that opens the modal", async () => {
  const r = render(() => (
    <Modal>
      <Modal.Trigger class="extra">
        <p>Settings</p>
      </Modal.Trigger>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog aria-label="Settings">x</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ));
  const t = r.container.querySelector("[data-slot=modal-trigger]") as HTMLElement;
  assert.equal(t.tagName, "DIV");
  assert.equal(t.getAttribute("role"), "button");
  assert.equal(t.className, "modal__trigger extra");
  t.click();
  await flush();
  assert.ok(dialog());
  r.unmount();
});

test("modal: useOverlayState + state prop (open / toggle / close, dismiss writes back)", async () => {
  let state!: ReturnType<typeof useOverlayState>;
  const calls: boolean[] = [];
  const r = render(() => {
    state = useOverlayState({ onOpenChange: (o) => calls.push(o) });
    return (
      <Modal state={state}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label="Controlled">x</Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    );
  });
  await flush();
  assert.equal(dialog(), null);
  state.open();
  await flush();
  assert.ok(dialog());
  assert.equal(state.isOpen(), true);
  escape(dialog()!);
  await flush();
  await flush();
  assert.equal(state.isOpen(), false);
  assert.equal(dialog(), null);
  state.toggle();
  await flush();
  assert.ok(dialog());
  state.close();
  await flush();
  await flush();
  assert.equal(dialog(), null);
  assert.deepEqual(calls, [true, false, true, false]);
  r.unmount();
});

test("modal: controlled isOpen / onOpenChange on Modal.Backdrop", async () => {
  let state!: ReturnType<typeof useOverlayState>;
  const r = render(() => {
    state = useOverlayState();
    return (
      <Modal.Backdrop isOpen={state.isOpen} onOpenChange={(o: boolean) => state.setOpen(o)}>
        <Modal.Container>
          <Modal.Dialog aria-label="Controlled">
            <Modal.Header>x</Modal.Header>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
  });
  state.setOpen(true);
  await flush();
  assert.ok(dialog());
  // upstream: Backdrop / Container provide the full slots, also without a Modal root
  assert.match(dialog()!.className, /\bmodal__dialog\b/);
  assert.equal(document.querySelector("[data-slot=modal-header]")!.className, "modal__header");
  escape(dialog()!);
  await flush();
  await flush();
  assert.equal(state.isOpen(), false);
  assert.equal(dialog(), null);
  r.unmount();
});

test("modal: parts outside a Modal get only the caller's class", () => {
  const r = render(() => (
    <div>
      <Modal.Header class="x">h</Modal.Header>
      <Modal.Trigger class="y">t</Modal.Trigger>
    </div>
  ));
  assert.equal(r.container.querySelector("[data-slot=modal-header]")!.className, "x");
  assert.equal(r.container.querySelector("[data-slot=modal-trigger]")!.className, "y");
  r.unmount();
});

// Rivet `Modal.Content` (identity spec §4.2): Backdrop + Container + Dialog + CloseTrigger folded, same markup.
const mask = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|for)="[^"]*"/g, "");
const openHtml = async (fixture: () => unknown) => {
  const r = render(fixture as never);
  r.container.querySelector("button")!.click();
  await flush();
  const html = mask(slot("modal-backdrop")?.outerHTML ?? "");
  r.unmount();
  await flush();
  return html;
};

test("modal: Modal.Content renders the compound form's markup (close button, Header string → Heading)", async () => {
  const compound = await openHtml(() => (
    <Modal>
      <Button>Open</Button>
      <Modal.Backdrop variant="blur">
        <Modal.Container placement="top" size="sm">
          <Modal.Dialog class="extra">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Welcome</Modal.Heading>
            </Modal.Header>
            <Modal.Body>Body</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ));
  const content = await openHtml(() => (
    <Modal>
      <Button>Open</Button>
      <Modal.Content backdrop="blur" placement="top" size="sm" class="extra">
        <Modal.Header>Welcome</Modal.Header>
        <Modal.Body>Body</Modal.Body>
      </Modal.Content>
    </Modal>
  ));
  assert.ok(compound.includes("modal__backdrop--blur") && compound.includes("modal__dialog--sm"), compound);
  assert.equal(content, compound);
});

test("modal: Modal.Content labels the dialog by the Header heading; closeButton={false}; render-function children", async () => {
  let closeFn: (() => void) | undefined;
  const r = render(() => (
    <Modal>
      <Button>Open</Button>
      <Modal.Content closeButton={false}>
        {({ close }: { close: () => void }) => {
          closeFn = close;
          return <Modal.Header>Settings</Modal.Header>;
        }}
      </Modal.Content>
    </Modal>
  ));
  r.container.querySelector("button")!.click();
  await flush();
  const d = dialog();
  assert.ok(d);
  const h = d.querySelector("[data-slot=modal-heading]") as HTMLElement;
  assert.equal(h?.textContent, "Settings");
  assert.match(h.tagName, /^H[1-6]$/);
  assert.equal(d.getAttribute("aria-labelledby"), h.id);
  assert.equal(slot("modal-close-trigger") === null, true);
  closeFn!();
  await flush();
  await flush();
  assert.equal(dialog() === null, true);
  r.unmount();
});

test("modal: Modal.Content takes the overlay state (isOpen signal two-way, isDismissable)", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const open = signal(false);
  const r = render(() => (
    <Modal.Content isOpen={open} isDismissable={false} aria-label="Standalone">
      <Modal.Body>Body</Modal.Body>
    </Modal.Content>
  ));
  assert.equal(dialog() === null, true);
  open.set(true);
  await flush();
  assert.equal(dialog()?.getAttribute("aria-label"), "Standalone");
  (slot("modal-close-trigger") as HTMLElement).click();
  await flush();
  await flush();
  assert.equal(open(), false);
  assert.equal(dialog() === null, true);
  r.unmount();
});
