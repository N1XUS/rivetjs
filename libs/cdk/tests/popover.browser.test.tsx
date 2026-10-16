// Ported from react-aria-components (packages/react-aria-components/test/Popover.test.js), react-spectrum,
// Apache-2.0, © Adobe.
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium, real timers; `settle` stands in for `act` /
// `jest.runAllTimers`); queries via `@testing-library/dom` `within(document.body)` (popovers are portalled);
// default classes `rv-*`; render props are accessors (`placement()`); `rerender(<TestPopover isEntering />)`
// → `isEntering` / `isExiting` passed as signals (a Rivet component runs once); `React.createRef` /
// `useRef` → `ref()`; `UNSAFE_PortalProvider getContainer` → `PortalProvider container`; the arrow's SVG
// path → a CSS-shaped span (icons rule); `<Pressable>` takes a render-function child (Rivet: spread its
// props); `jest.fn` → `vi.fn`.
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files); "portalContainer" (deprecated `UNSTABLE_portalContainer` deleted: PortalProvider only).
// Added: collection build pass renders children directly (RAC `useIsHidden`).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Dialog, DialogTrigger } from "../dialog/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { OverlayArrow } from "../overlay-arrow/index.tsx";
import { Popover, type PopoverProps } from "../popover/index.tsx";
import { Pressable } from "../interactions/pressable.tsx";
import { Select, SelectValue } from "../select/index.tsx";
import { PortalProvider } from "../portal/index.tsx";
import { buildCollectionFrom } from "../collections/components.tsx";

const screen = () => within(document.body);
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flush();
};

const Arrow = () => <span style={{ display: "block", width: "12px", height: "6px", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />;

function TestPopover(props: PopoverProps) {
  return (
    <DialogTrigger>
      <Button />
      <Popover {...props}>
        <OverlayArrow>
          <Arrow />
        </OverlayArrow>
        <Dialog>Popover</Dialog>
      </Popover>
    </DialogTrigger>
  );
}

afterEach(async () => {
  cleanup();
  await flush();
});

describe("Popover", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup({ delay: null });
  });

  it("works with a dialog", async () => {
    render(() => <TestPopover />);
    const button = screen().getByRole("button");
    expect(screen().queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(button);
    await settle();

    const dialog = screen().getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.closest(".rv-Popover")).toHaveAttribute("data-trigger", "DialogTrigger");

    expect(button).toHaveAttribute("aria-controls");
    expect(dialog).toHaveAttribute("id", button.getAttribute("aria-controls"));

    await user.click(document.body);
    await settle();

    expect(dialog).not.toBeInTheDocument();
  });

  it("applies overlay id to standalone popover", async () => {
    render(() => (
      <DialogTrigger>
        <Button />
        <Popover aria-label="Popover">Popover content</Popover>
      </DialogTrigger>
    ));

    const button = screen().getByRole("button");
    await user.click(button);
    await settle();

    const dialog = screen().getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-controls");
    expect(dialog).toHaveAttribute("id", button.getAttribute("aria-controls"));
  });

  it("should handle focus", async () => {
    render(() => <TestPopover />);
    const button = screen().getByRole("button");

    await user.tab();
    expect(button).toHaveFocus();

    await user.click(button);
    await settle();

    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveFocus();

    await user.click(document.body);
    await settle();

    expect(button).toHaveFocus();
  });

  it("should support render props", async () => {
    render(() => (
      <DialogTrigger>
        <Button />
        <Popover placement="bottom start">{({ placement }) => <Dialog>Popover at {placement()}</Dialog>}</Popover>
      </DialogTrigger>
    ));

    await user.click(screen().getByRole("button"));
    await settle();

    expect(screen().getByRole("dialog")).toHaveTextContent("Popover at bottom");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support being used standalone", async () => {
    const triggerRef = ref<HTMLSpanElement>();
    const onOpenChange = vi.fn();
    render(() => (
      <>
        <span ref={triggerRef}>Trigger</span>
        <Popover isOpen triggerRef={triggerRef} onOpenChange={onOpenChange}>
          <Dialog aria-label="Popover">A popover</Dialog>
        </Popover>
      </>
    ));
    await settle();

    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveTextContent("A popover");

    // userEvent seems to trigger a double close event
    fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(document.body, { button: 0, pointerType: "mouse" });
    fireEvent.click(document.body, { button: 0 });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should not leak PopoverContext to nested popovers", async () => {
    // Rivet: the Select's collection build pass renders the popover children inside a computed, where a `ref()`
    // signal write throws ("Signal writes are not allowed during computed evaluation"); a callback ref keeps the anchor.
    function NestedPopover() {
      let anchor: HTMLButtonElement | null = null;
      const triggerRef = (() => anchor) as unknown as ReturnType<typeof ref<HTMLButtonElement>>;
      return (
        <>
          <button ref={(el: HTMLButtonElement | null) => (anchor = el)}>anchor</button>
          <Popover triggerRef={triggerRef} isOpen isNonModal data-testid="nested">
            {({ trigger }) => `nested trigger=${String(trigger)}`}
          </Popover>
        </>
      );
    }

    render(() => (
      <Select aria-label="Select" defaultOpen>
        <Button>
          <SelectValue />
        </Button>
        <Popover data-testid="outer">
          <ListBox>
            <ListBoxItem id="a">a</ListBoxItem>
          </ListBox>
          <NestedPopover />
        </Popover>
      </Select>
    ));
    await settle();

    expect(screen().getByTestId("outer")).toHaveAttribute("data-trigger", "Select");
    const nested = screen().getByTestId("nested");
    expect(nested).toHaveTextContent("nested trigger=null");
    expect(nested).not.toHaveAttribute("data-trigger");
    expect(nested).not.toHaveAttribute("aria-labelledby");
  });

  it("isOpen and defaultOpen should override state from context", async () => {
    const onOpenChange = vi.fn();
    render(() => (
      <DialogTrigger>
        <Button />
        <Popover isOpen onOpenChange={onOpenChange}>
          <Dialog>A popover</Dialog>
        </Popover>
      </DialogTrigger>
    ));
    await settle();

    expect(screen().getByRole("dialog")).toHaveTextContent("A popover");

    fireEvent.pointerDown(document.body, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(document.body, { button: 0, pointerType: "mouse" });
    fireEvent.click(document.body, { button: 0 });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("supports isEntering and isExiting props", async () => {
    const isEntering = signal<boolean | undefined>(true);
    const isExiting = signal<boolean | undefined>(undefined);
    render(() => <TestPopover isEntering={isEntering} isExiting={isExiting} />);

    const button = screen().getByRole("button");
    await user.click(button);
    await settle();

    const popover = screen().getByRole("dialog").closest(".rv-Popover")!;
    expect(popover).toHaveAttribute("data-entering");

    isEntering.set(undefined);
    await settle();
    expect(popover).not.toHaveAttribute("data-entering");

    isExiting.set(true);
    await user.click(button);
    await settle();

    expect(popover).toBeInTheDocument();
    expect(popover).toHaveAttribute("data-exiting");

    isExiting.set(undefined);
    await settle();
    expect(popover).not.toBeInTheDocument();
  });

  it("supports overriding styles", async () => {
    render(() => (
      <DialogTrigger>
        <Button />
        <Popover style={{ zIndex: 5 }}>
          <OverlayArrow style={{ top: "5px" }} data-testid="arrow">
            <Arrow />
          </OverlayArrow>
          <Dialog>Popover</Dialog>
        </Popover>
      </DialogTrigger>
    ));

    await user.click(screen().getByRole("button"));
    await settle();

    const popover = screen().getByRole("dialog").closest(".rv-Popover");
    expect(popover).toHaveAttribute("style", expect.stringContaining("z-index: 5"));
    expect(screen().getByTestId("arrow")).toHaveAttribute("style", expect.stringContaining("top: 5px"));
  });

  describe("portalProvider", () => {
    it("should render the dialog in the portal container set by the PortalProvider", async () => {
      const container = ref<HTMLDivElement>();
      render(() => (
        <>
          <PortalProvider container={container}>
            <DialogTrigger>
              <Button />
              <Popover>
                <OverlayArrow>
                  <Arrow />
                </OverlayArrow>
                <Dialog>Popover</Dialog>
              </Popover>
            </DialogTrigger>
          </PortalProvider>
          <div ref={container} data-testid="custom-container" />
        </>
      ));

      await user.click(screen().getByRole("button"));
      await settle();

      expect(screen().getByRole("dialog").closest('[data-testid="custom-container"]')).toBe(screen().getByTestId("custom-container"));
    });
  });

  it.skip("portalContainer: should render the dialog in the portal container", () => {
    // Deprecated `UNSTABLE_portalContainer` deleted: PortalProvider only (covered above).
  });

  it("should support custom Pressable trigger", async () => {
    render(() => (
      <DialogTrigger>
        <Pressable>
          {(props) => (
            <span role="button" {...props}>
              Trigger
            </span>
          )}
        </Pressable>
        <Popover>
          <Dialog>Popover</Dialog>
        </Popover>
      </DialogTrigger>
    ));

    await user.click(screen().getByRole("button"));
    await settle();

    expect(screen().getByRole("dialog")).toBeInTheDocument();
  });

  // Rivet: on a resumed page the trigger's ref can bind after the popover opened (a cold press before the ref's
  // client binding ran). RA positions in a layout effect whenever trigger and overlay both exist: the popover must
  // position when the trigger arrives, not stay unpositioned (ui-components popover flake, 2026-10-09).
  it("positions once a trigger ref set after opening arrives", async () => {
    const triggerRef = ref<HTMLButtonElement>();
    const shown = signal(false);
    render(() => (
      <>
        {() => (shown() ? <button ref={triggerRef}>Trigger</button> : null)}
        <Popover isOpen triggerRef={triggerRef} data-testid="late">
          <Dialog>Popover</Dialog>
        </Popover>
      </>
    ));
    await settle();
    const popover = screen().getByTestId("late");
    expect(popover).not.toHaveAttribute("data-placement");
    shown.set(true);
    await settle();
    expect(popover).toHaveAttribute("data-placement", "bottom");
    expect(popover.style.top).not.toBe("");
  });

  // Rivet: RAC useIsHidden — in a collection's build pass (hidden tree) the popover renders its children
  // directly (no portal, no presence, even while closed), so collection items inside it still register.
  it("renders its children directly in a collection build pass", () => {
    const collection = buildCollectionFrom(() => (
      <Popover>
        <ListBoxItem id="inside">inside</ListBoxItem>
      </Popover>
    ));
    expect([...collection.getKeys()]).toEqual(["inside"]);
    expect(document.querySelector(".rv-Popover")).toBeNull();
  });
});
