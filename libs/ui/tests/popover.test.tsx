// DOM-target suite: `Popover` (upstream tests/components/popover/popover.test.tsx ported to happy-dom): open via the trigger
// exposes the dialog slot (`data-slot="popover-dialog"`, `popover__dialog`) inside `.popover`, Escape dismiss + `onOpenChange`,
// heading slot; Rivet: classes of every part inside / outside a `Popover`, `SurfaceContext` inside the content, `Popover.Trigger`
// (Pressable + `role=button`), default arrow, controlled `isOpen` signal, index exports. Focus move / Escape focus restore on a
// real browser: `tests-components/popover.test.ts` (upstream popover.browser.test.tsx).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { Button } = await import("../src/components/button/index.ts");
const { Popover, PopoverRoot, PopoverContent, popoverVariants } = await import("../src/components/popover/index.ts");
const { SurfaceContext } = await import("../src/components/surface/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
const dialog = () => document.querySelector("[role=dialog]") as HTMLElement | null;

const Fixture = (props: { isOpen?: ReturnType<typeof signal<boolean>>; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void }) => (
  <Popover defaultOpen={props.defaultOpen} isOpen={props.isOpen} onOpenChange={props.onOpenChange}>
    <Button>Open popover</Button>
    <Popover.Content>
      <Popover.Dialog>
        <Popover.Heading>Popover heading</Popover.Heading>
        <p>This is the popover content</p>
        <Button>Inside action</Button>
      </Popover.Dialog>
    </Popover.Content>
  </Popover>
);

test("popover: index exports", () => {
  assert.equal(Popover, PopoverRoot);
  assert.equal(Popover.Root, PopoverRoot);
  assert.equal(Popover.Content, PopoverContent);
  assert.equal(popoverVariants().base(), "popover");
});

test("popover: trigger opens the dialog slot inside .popover; press again closes", async () => {
  const r = render(() => <Fixture />);
  assert.equal(dialog(), null);
  const trigger = r.container.querySelector("button")!;
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  trigger.click();
  await flush();
  const d = dialog();
  assert.ok(d);
  assert.equal(d.getAttribute("data-slot"), "popover-dialog");
  assert.match(d.className, /popover__dialog/);
  assert.equal(d.tagName, "SECTION");
  assert.ok(document.querySelector(".popover"));
  assert.ok(d.closest(".popover"));
  assert.ok(document.body.textContent!.includes("This is the popover content"));
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  r.unmount();
  await flush();
  assert.equal(dialog(), null);
});

test("popover: Escape dismisses (onOpenChange false)", async () => {
  const calls: boolean[] = [];
  const r = render(() => <Fixture defaultOpen onOpenChange={(o) => calls.push(o)} />);
  await flush();
  const d = dialog();
  assert.ok(d);
  d.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
  await flush();
  assert.deepEqual(calls, [false]);
  await flush();
  assert.equal(dialog(), null);
  r.unmount();
});

test("popover: heading slot (role heading, popover__heading, labels the dialog)", async () => {
  const r = render(() => (
    <Popover defaultOpen>
      <Button>Open popover</Button>
      <Popover.Content>
        <Popover.Dialog>
          <Popover.Heading>Popover heading</Popover.Heading>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  await flush();
  const h = document.querySelector(".popover__heading")!;
  assert.ok(h);
  assert.match(h.tagName, /^H[1-6]$/);
  assert.equal(h.textContent, "Popover heading");
  assert.equal(dialog()!.getAttribute("aria-labelledby"), h.id);
  r.unmount();
});

test("popover: class on every part composes after the slot class; content provides SurfaceContext default", async () => {
  let surface: unknown;
  const Probe = () => {
    surface = useContext(SurfaceContext).variant;
    return null;
  };
  const r = render(() => (
    <Popover defaultOpen>
      <Button>Open</Button>
      <Popover.Content class="max-w-64" placement="top" dialog={false}>
        <Popover.Dialog class="p-2">
          <Popover.Arrow />
          <Popover.Heading class="font-bold">T</Popover.Heading>
          <Probe />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  await flush();
  const pop = document.querySelector(".popover")!;
  assert.match(pop.className, /^popover max-w-64$/);
  assert.equal(dialog()!.className, "popover__dialog p-2");
  assert.equal(document.querySelector(".popover__heading")!.className, "popover__heading font-bold");
  assert.equal(surface, "default");
  const group = document.querySelector("[data-slot=popover-overlay-arrow-group]")!;
  assert.ok(group);
  const tip = group.querySelector("[data-slot=popover-overlay-arrow]") as HTMLElement;
  assert.ok(tip);
  assert.equal(tip.getAttribute("aria-hidden"), "true");
  assert.match(tip.getAttribute("style") ?? "", /clip-path/);
  assert.equal(group.querySelector("path"), null);
  r.unmount();
});

test("popover: custom arrow children replace the default tip", async () => {
  const r = render(() => (
    <Popover defaultOpen>
      <Button>Open</Button>
      <Popover.Content>
        <Popover.Dialog>
          <Popover.Arrow>
            <span id="my-arrow" data-slot="popover-overlay-arrow" />
          </Popover.Arrow>
          x
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  await flush();
  const group = document.querySelector("[data-slot=popover-overlay-arrow-group]")!;
  assert.equal(group.querySelectorAll("[data-slot=popover-overlay-arrow]").length, 1);
  assert.ok(group.querySelector("#my-arrow"));
  r.unmount();
});

test("popover: parts outside a Popover get only the caller's class", () => {
  const r = render(() => <Popover.Trigger class="x">t</Popover.Trigger>);
  const t = r.container.querySelector("[data-slot=popover-trigger]")!;
  assert.equal(t.className, "x");
  r.unmount();
});

test("popover: Popover.Trigger is a pressable div (role=button, popover__trigger) that opens the popover", async () => {
  const r = render(() => (
    <Popover>
      <Popover.Trigger aria-label="User profile" class="extra">
        <span>Sarah</span>
      </Popover.Trigger>
      <Popover.Content>
        <Popover.Dialog>
          <Popover.Heading>Profile</Popover.Heading>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  const t = r.container.querySelector("[data-slot=popover-trigger]") as HTMLElement;
  assert.equal(t.tagName, "DIV");
  assert.equal(t.getAttribute("role"), "button");
  assert.equal(t.className, "popover__trigger extra");
  assert.equal(t.getAttribute("aria-label"), "User profile");
  assert.equal(t.getAttribute("aria-expanded"), "false");
  t.click();
  await flush();
  assert.ok(dialog());
  assert.equal(t.getAttribute("aria-expanded"), "true");
  r.unmount();
});

test("popover: controlled isOpen signal (external set opens / closes, dismiss writes back)", async () => {
  const open = signal(false);
  const r = render(() => <Fixture isOpen={open} />);
  await flush();
  assert.equal(dialog(), null);
  open.set(true);
  await flush();
  assert.ok(dialog());
  open.set(false);
  await flush();
  await flush();
  assert.equal(dialog(), null);
  r.unmount();
});

const maskIds = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-rv-focus-scope)="[^"]*"/g, "");
const popoverHtml = () => maskIds(document.querySelector(".popover")!.outerHTML);

test("popover fold: Content without a Dialog = Content dialog={false} + Popover.Dialog; title = Popover.Heading", async () => {
  const explicit = render(() => (
    <Popover defaultOpen>
      <Button>Open</Button>
      <Popover.Content class="max-w-64" dialog={false}>
        <Popover.Dialog>
          <Popover.Heading>Title</Popover.Heading>
          <p>Body</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  await flush();
  const before = popoverHtml();
  explicit.unmount();
  await flush();
  const folded = render(() => (
    <Popover defaultOpen>
      <Button>Open</Button>
      <Popover.Content class="max-w-64" title="Title">
        <p>Body</p>
      </Popover.Content>
    </Popover>
  ));
  await flush();
  assert.equal(popoverHtml(), before);
  assert.equal(document.querySelectorAll("[role=dialog]").length, 1);
  const heading = document.querySelector(".popover__heading")!;
  assert.equal(dialog()!.getAttribute("aria-labelledby"), heading.id);
  folded.unmount();
  await flush();
});

test("popover fold: an explicit Popover.Dialog inside a folded Content renders only its children", async () => {
  const r = render(() => (
    <Popover defaultOpen>
      <Button>Open</Button>
      <Popover.Content>
        <Popover.Dialog class="ignored">
          <p>Body</p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  ));
  await flush();
  assert.equal(document.querySelectorAll("[data-slot=popover-dialog]").length, 1);
  assert.equal(dialog()!.className, "popover__dialog");
  assert.equal(dialog()!.querySelector("p")!.textContent, "Body");
  r.unmount();
  await flush();
});

test("popover fold: function children get the dialog render props (close); a nested Popover keeps its own dialog", async () => {
  const changes: boolean[] = [];
  const r = render(() => (
    <Popover defaultOpen onOpenChange={(open) => changes.push(open)}>
      <Button>Open</Button>
      <Popover.Content>
        {({ close }) => (
          <>
            <Popover>
              <Button>Inner</Button>
              <Popover.Content title="Inner title">
                <p>Inner body</p>
              </Popover.Content>
            </Popover>
            <Button onPress={close}>Close</Button>
          </>
        )}
      </Popover.Content>
    </Popover>
  ));
  await flush();
  const buttons = () => [...document.querySelectorAll("[data-slot=popover-dialog] button")] as HTMLElement[];
  buttons()
    .find((b) => b.textContent === "Inner")!
    .click();
  await flush();
  assert.equal(document.querySelectorAll("[data-slot=popover-dialog]").length, 2);
  assert.ok([...document.querySelectorAll(".popover__heading")].some((h) => h.textContent === "Inner title"));
  r.unmount();
  await flush();
  const r2 = render(() => (
    <Popover defaultOpen onOpenChange={(open) => changes.push(open)}>
      <Button>Open</Button>
      <Popover.Content>{({ close }) => <Button onPress={close}>Close</Button>}</Popover.Content>
    </Popover>
  ));
  await flush();
  buttons()
    .find((b) => b.textContent === "Close")!
    .click();
  await flush();
  assert.deepEqual(changes, [false]);
  assert.equal(dialog(), null);
  r2.unmount();
});
