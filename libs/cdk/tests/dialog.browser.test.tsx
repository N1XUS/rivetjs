// Ported from react-aria-components (packages/react-aria-components/test/Dialog.test.js), react-spectrum,
// Apache-2.0, © Adobe.
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium, real timers; `flush` stands in for `act`);
// queries via `@testing-library/dom` `within(document.body)` (overlays are portalled); default classes
// `rv-*` and no `data-rac`; `rerender(<TestModal isEntering />)` → props passed as signals (a Rivet
// component runs once); `UNSAFE_PortalProvider getContainer` → `PortalProvider container` (a `ref()`);
// `jest.fn` → `vi.fn`; RA test-utils `User` → `@rivetjs/testing/user`.
// "works with popover": the arrow is an `<OverlayArrow>` with a lucide-free plain `<svg>` (no path).
// Skipped: "portalContainer" (UNSTABLE_portalContainer deleted, decision 12); "ensure Input
// autoFocus works when opening Modal from MenuItem via keyboard" (needs the RAC Menu re-port, lane C3);
// "should not close Modal when DateRangePicker is dismissed by outside click" (story from
// Modal.stories, needs the RAC DateRangePicker re-port, lane C7).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { Heading } from "../heading/index.tsx";
import { Text } from "../text/index.tsx";
import { PortalProvider } from "../portal/index.tsx";
import { Dialog, DialogTrigger } from "../dialog/index.tsx";
import { Modal, ModalOverlay, type ModalOverlayProps } from "../modal/index.tsx";
import { Popover } from "../popover/index.tsx";
import { OverlayArrow } from "../overlay-arrow/index.tsx";

const screen = () => within(document.body);
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
};

afterEach(() => cleanup());

describe("Dialog", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User({ advanceTimer: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) });
  beforeAll(() => {
    user = userEvent.setup({ delay: null });
  });

  it("should have a base default set of attributes", () => {
    render(() => (
      <Dialog>
        <Heading slot="title">Title</Heading>
      </Dialog>
    ));
    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveClass("rv-Dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", screen().getByRole("heading").id);
  });

  // RA mergeIds: a title with its own id keeps it, and aria-labelledby follows (no dangling generated id).
  it("is labelled by a title heading with its own id", () => {
    render(() => (
      <Dialog>
        <Heading slot="title" id="custom-title">
          Title
        </Heading>
      </Dialog>
    ));
    const dialog = screen().getByRole("dialog");
    expect(screen().getByRole("heading")).toHaveAttribute("id", "custom-title");
    expect(dialog).toHaveAttribute("aria-labelledby", "custom-title");
  });

  // Rivet: plain text children stay reactive (`A {p()}` updates with the signal).
  it("keeps plain text children reactive", async () => {
    const p = signal("one");
    render(() => <Dialog aria-label="x">A {p()}</Dialog>);
    expect(screen().getByRole("dialog")).toHaveTextContent("A one");
    p.set("two");
    await settle();
    expect(screen().getByRole("dialog")).toHaveTextContent("A two");
  });

  it("works with modal", async () => {
    render(() => (
      <DialogTrigger>
        <Button>Delete…</Button>
        <Modal data-test="modal">
          <Dialog role="alertdialog" data-test="dialog">
            {({ close }) => (
              <>
                <Heading slot="title">Alert</Heading>
                <Text slot="description">This is the alert message.</Text>
                <Button onPress={() => close()}>Close</Button>
              </>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
    ));

    const button = screen().getByRole("button");
    const dialogTester = testUtilUser.createTester("Dialog", { root: button, overlayType: "modal" });
    await dialogTester.open();
    const dialog = dialogTester.getDialog()!;
    expect(dialog).toHaveAttribute("role", "alertdialog");
    const heading = screen().getByRole("heading");
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    expect(dialog).toHaveAttribute("data-test", "dialog");
    expect(dialog.closest(".rv-Modal")).toHaveAttribute("data-test", "modal");
    expect(dialog.closest(".rv-ModalOverlay")).toBeInTheDocument();

    const close = within(dialog).getByRole("button");
    await user.click(close);
    await settle();

    expect(dialog).not.toBeInTheDocument();
  });

  it('should set aria-describedby when Text slot="description" is used in alertdialog', async () => {
    render(() => (
      <DialogTrigger>
        <Button>Open</Button>
        <Modal>
          <Dialog role="alertdialog">
            {({ close }) => (
              <>
                <Heading slot="title">Alert Title</Heading>
                <Text slot="description">This is the alert message.</Text>
                <Button onPress={() => close()}>OK</Button>
              </>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
    ));

    const button = screen().getByRole("button");
    const dialogTester = testUtilUser.createTester("Dialog", { root: button, overlayType: "modal" });
    await dialogTester.open();
    const dialog = dialogTester.getDialog()!;
    expect(dialog).toHaveAttribute("role", "alertdialog");
    expect(dialog).toHaveAttribute("aria-describedby");
    const descEl = document.getElementById(dialog.getAttribute("aria-describedby")!);
    expect(descEl).not.toBeNull();
    expect(descEl!.textContent).toBe("This is the alert message.");
  });

  it("works with modal and custom underlay", async () => {
    render(() => (
      <DialogTrigger>
        <Button>Delete…</Button>
        <ModalOverlay class="underlay" data-test="underlay">
          <Modal class="modal" data-test="modal">
            <Dialog role="alertdialog" data-test="dialog">
              {({ close }) => (
                <>
                  <Heading slot="title">Alert</Heading>
                  <Text slot="description">This is the alert message.</Text>
                  <Button onPress={() => close()}>Close</Button>
                </>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    ));

    await user.click(screen().getByRole("button"));
    await settle();

    const dialog = screen().getByRole("alertdialog");
    const heading = screen().getByRole("heading");
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    expect(dialog).toHaveAttribute("data-test", "dialog");
    expect(dialog.closest(".modal")).toHaveAttribute("data-test", "modal");
    expect(dialog.closest(".underlay")).toHaveAttribute("data-test", "underlay");

    await user.click(within(dialog).getByRole("button"));
    await settle();
    expect(dialog).not.toBeInTheDocument();
  });

  it("has dismiss button when isDismissable", async () => {
    render(() => (
      <DialogTrigger>
        <Button>Delete…</Button>
        <Modal data-test="modal" isDismissable>
          <Dialog role="alertdialog" data-test="dialog">
            {({ close }) => (
              <>
                <Heading slot="title">Alert</Heading>
                <Text slot="description">This is the alert message.</Text>
                <Button onPress={() => close()}>Close</Button>
              </>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
    ));

    await user.click(screen().getByRole("button"));
    await settle();
    const dialog = screen().getByRole("alertdialog");
    await user.click(screen().getByLabelText("Dismiss"));
    await settle();
    expect(dialog).not.toBeInTheDocument();
  });

  it("works with popover", async () => {
    render(() => (
      <DialogTrigger>
        <Button aria-label="Help">?</Button>
        <Popover data-test="popover">
          <OverlayArrow data-test="arrow">
            <svg width={12} height={12} />
          </OverlayArrow>
          <Dialog data-test="dialog">
            <Heading slot="title">Help</Heading>
            <p>For help accessing your account, please contact support.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
    ));

    const button = screen().getByRole("button");
    expect(button).not.toHaveAttribute("data-pressed");

    const dialogTester = testUtilUser.createTester("Dialog", { root: button, overlayType: "popover" });
    await dialogTester.open();
    await settle();
    expect(button).toHaveAttribute("data-pressed");

    const dialog = dialogTester.getDialog()!;
    const heading = screen().getByRole("heading");
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    expect(dialog).toHaveAttribute("data-test", "dialog");
    expect(dialog).toHaveClass("rv-Dialog");

    const popover = dialog.closest(".rv-Popover") as HTMLElement;
    expect(popover).toHaveStyle("position: absolute");
    expect(popover).toHaveAttribute("data-test", "popover");

    const arrow = popover.querySelector(".rv-OverlayArrow");
    expect(arrow).toHaveStyle("position: absolute");
    expect(arrow).toHaveAttribute("data-test", "arrow");

    await user.click(document.body);
    await settle();
    expect(dialog).not.toBeInTheDocument();
  });

  it("should get default aria label from trigger", async () => {
    render(() => (
      <DialogTrigger>
        <Button>Settings</Button>
        <Popover>
          <Dialog>Test</Dialog>
        </Popover>
      </DialogTrigger>
    ));
    const button = screen().getByRole("button");
    await user.click(button);
    await settle();
    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", button.id);
    await user.click(document.body);
    await settle();
    expect(dialog).not.toBeInTheDocument();
  });

  it("should support render props", async () => {
    render(() => (
      <DialogTrigger>
        <Button aria-label="Help">?</Button>
        <Popover>
          <Dialog>
            {({ close }) => (
              <>
                <Heading slot="title">Help</Heading>
                <p>For help accessing your account, please contact support.</p>
                <Button onPress={() => close()}>Dismiss</Button>
              </>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    ));
    await user.click(screen().getByRole("button"));
    await settle();
    const dialog = screen().getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button"));
    await settle();
    expect(dialog).not.toBeInTheDocument();
  });

  it("should get default aria label from trigger (Modal)", async () => {
    // Rivet: the upstream case with a Modal in place of the Popover (same DialogContext fallback).
    render(() => (
      <DialogTrigger>
        <Button>Settings</Button>
        <Modal isDismissable>
          <Dialog>Test</Dialog>
        </Modal>
      </DialogTrigger>
    ));
    const button = screen().getByRole("button");
    await user.click(button);
    await settle();
    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", button.id);
    expect(button).toHaveAttribute("aria-controls", dialog.id);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("data-pressed", "true");
  });

  it("should support Modal being used standalone", async () => {
    const onOpenChange = vi.fn();
    render(() => (
      <Modal isDismissable isOpen onOpenChange={onOpenChange}>
        <Dialog aria-label="Modal">A modal</Dialog>
      </Modal>
    ));
    await settle();
    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveTextContent("A modal");

    await user.click(document.body);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("isOpen and defaultOpen should override state from context", async () => {
    const onOpenChange = vi.fn();
    render(() => (
      <DialogTrigger>
        <Button />
        <Modal isDismissable isOpen onOpenChange={onOpenChange}>
          <Dialog aria-label="Modal">A modal</Dialog>
        </Modal>
      </DialogTrigger>
    ));
    await settle();
    const dialog = screen().getByRole("dialog");
    expect(dialog).toHaveTextContent("A modal");

    await user.click(document.body);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("supports isEntering and isExiting props", async () => {
    const isEntering = signal<boolean | undefined>(true);
    const isExiting = signal<boolean | undefined>(undefined);
    render(() => (
      <DialogTrigger>
        <Button />
        <Modal isEntering={isEntering} isExiting={isExiting}>
          <Dialog aria-label="Modal">A modal</Dialog>
        </Modal>
      </DialogTrigger>
    ));

    const button = screen().getByRole("button");
    await user.click(button);
    await settle();

    const modal = screen().getByRole("dialog").closest(".rv-ModalOverlay")!;
    expect(modal).toHaveAttribute("data-entering");

    isEntering.set(undefined);
    await settle();
    expect(modal).not.toHaveAttribute("data-entering");

    isExiting.set(true);
    // RAC clicks the trigger; the page outside a modal is inert, so close through Escape.
    await user.keyboard("{Escape}");
    await settle();

    expect(modal).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-exiting");

    isExiting.set(undefined);
    await settle();
    expect(modal).not.toBeInTheDocument();
  });

  describe("onEnter and onExit", () => {
    function deferred() {
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      return { promise, resolve };
    }

    function TestModal(props: { overlayProps?: Partial<ModalOverlayProps>; modalProps?: Partial<ModalOverlayProps> }) {
      const overlayProps = props.overlayProps ?? {},
        modalProps = props.modalProps ?? {};
      return (
        <DialogTrigger>
          <Button>Open</Button>
          <ModalOverlay data-testid="overlay" {...overlayProps}>
            <Modal data-testid="modal" {...modalProps}>
              <Dialog aria-label="Modal">
                <Button slot="close">Close</Button>
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
      );
    }

    it("calls onEnter on ModalOverlay and Modal with their elements when opening", async () => {
      const onOverlayEnter = vi.fn();
      const onModalEnter = vi.fn();
      render(() => <TestModal overlayProps={{ onEnter: onOverlayEnter }} modalProps={{ onEnter: onModalEnter }} />);

      expect(onOverlayEnter).not.toHaveBeenCalled();
      expect(onModalEnter).not.toHaveBeenCalled();

      await user.click(screen().getByRole("button"));
      await settle();

      const overlay = screen().getByTestId("overlay");
      const modal = screen().getByTestId("modal");
      expect(onOverlayEnter).toHaveBeenCalledTimes(1);
      expect(onOverlayEnter).toHaveBeenCalledWith(overlay);
      expect(onModalEnter).toHaveBeenCalledTimes(1);
      expect(onModalEnter).toHaveBeenCalledWith(modal);

      // Synchronous callbacks complete the entry immediately.
      expect(overlay).not.toHaveAttribute("data-entering");
      expect(modal).not.toHaveAttribute("data-entering");
    });

    it("remains entering until the promise returned by ModalOverlay onEnter resolves", async () => {
      const { promise, resolve } = deferred();
      const onEnter = vi.fn(() => promise);
      render(() => <TestModal overlayProps={{ onEnter }} />);

      await user.click(screen().getByRole("button"));
      await settle();

      const overlay = screen().getByTestId("overlay");
      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(overlay).toHaveAttribute("data-entering");
      expect(screen().getByTestId("modal")).not.toHaveAttribute("data-entering");

      resolve();
      await settle();
      expect(overlay).not.toHaveAttribute("data-entering");
      expect(onEnter).toHaveBeenCalledTimes(1);
    });

    it("remains entering until the promise returned by Modal onEnter resolves", async () => {
      const { promise, resolve } = deferred();
      const onEnter = vi.fn(() => promise);
      render(() => <TestModal modalProps={{ onEnter }} />);

      await user.click(screen().getByRole("button"));
      await settle();

      const modal = screen().getByTestId("modal");
      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(modal).toHaveAttribute("data-entering");
      expect(screen().getByTestId("overlay")).not.toHaveAttribute("data-entering");

      resolve();
      await settle();
      expect(modal).not.toHaveAttribute("data-entering");
      expect(onEnter).toHaveBeenCalledTimes(1);
    });

    it("calls onExit on ModalOverlay and Modal with their elements when closing", async () => {
      const onOverlayExit = vi.fn();
      const onModalExit = vi.fn();
      render(() => <TestModal overlayProps={{ onExit: onOverlayExit }} modalProps={{ onExit: onModalExit }} />);

      await user.click(screen().getByRole("button"));
      await settle();
      const overlay = screen().getByTestId("overlay");
      const modal = screen().getByTestId("modal");
      expect(onOverlayExit).not.toHaveBeenCalled();
      expect(onModalExit).not.toHaveBeenCalled();

      await user.click(screen().getByRole("button", { name: "Close" }));
      await settle();

      expect(onOverlayExit).toHaveBeenCalledTimes(1);
      expect(onOverlayExit).toHaveBeenCalledWith(overlay);
      expect(onModalExit).toHaveBeenCalledTimes(1);
      expect(onModalExit).toHaveBeenCalledWith(modal);

      // Synchronous callbacks complete the exit immediately.
      expect(screen().queryByTestId("overlay")).toBeNull();
    });

    it("remains mounted until the promise returned by ModalOverlay onExit resolves", async () => {
      const { promise, resolve } = deferred();
      const onExit = vi.fn(() => promise);
      render(() => <TestModal overlayProps={{ onExit }} />);

      await user.click(screen().getByRole("button"));
      await settle();
      const overlay = screen().getByTestId("overlay");
      const modal = screen().getByTestId("modal");

      await user.click(screen().getByRole("button", { name: "Close" }));
      await settle();
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(onExit).toHaveBeenCalledWith(overlay);
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("data-exiting");
      expect(modal).toHaveAttribute("data-exiting");

      resolve();
      await settle();
      expect(overlay).not.toBeInTheDocument();
      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("remains mounted until the promise returned by Modal onExit resolves", async () => {
      const { promise, resolve } = deferred();
      const onExit = vi.fn(() => promise);
      render(() => <TestModal modalProps={{ onExit }} />);

      await user.click(screen().getByRole("button"));
      await settle();
      const overlay = screen().getByTestId("overlay");
      const modal = screen().getByTestId("modal");

      await user.click(screen().getByRole("button", { name: "Close" }));
      await settle();
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(onExit).toHaveBeenCalledWith(modal);
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("data-exiting");
      expect(modal).toHaveAttribute("data-exiting");

      resolve();
      await settle();
      expect(overlay).not.toBeInTheDocument();
      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it("waits for both ModalOverlay and Modal onExit promises before unmounting", async () => {
      const overlayExit = deferred();
      const modalExit = deferred();
      render(() => <TestModal overlayProps={{ onExit: () => overlayExit.promise }} modalProps={{ onExit: () => modalExit.promise }} />);

      await user.click(screen().getByRole("button"));
      await settle();
      const overlay = screen().getByTestId("overlay");

      await user.click(screen().getByRole("button", { name: "Close" }));
      await settle();
      overlayExit.resolve();
      await settle();
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("data-exiting");

      modalExit.resolve();
      await settle();
      expect(overlay).not.toBeInTheDocument();
    });

    // Skipped: "calls the latest onEnter and onExit callbacks" — a re-render with new callback props has no
    // Rivet equivalent (components run once; props are read once).

    it("supports onEnter and onExit on a standalone Modal", async () => {
      const enter = deferred();
      const exit = deferred();
      const onEnter = vi.fn(() => enter.promise);
      const onExit = vi.fn(() => exit.promise);
      const isOpen = signal(true);
      render(() => (
        <Modal data-testid="modal" onEnter={onEnter} onExit={onExit} isOpen={isOpen}>
          <Dialog aria-label="Modal">A modal</Dialog>
        </Modal>
      ));
      await settle();
      const modal = screen().getByTestId("modal");
      expect(onEnter).toHaveBeenCalledTimes(1);
      expect(onEnter).toHaveBeenCalledWith(modal);
      expect(modal).toHaveAttribute("data-entering");

      enter.resolve();
      await settle();
      expect(modal).not.toHaveAttribute("data-entering");

      isOpen.set(false);
      await settle();
      expect(onExit).toHaveBeenCalledTimes(1);
      expect(onExit).toHaveBeenCalledWith(modal);
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute("data-exiting");

      exit.resolve();
      await settle();
      expect(modal).not.toBeInTheDocument();
    });
  });

  describe("portalProvider", () => {
    it("should render the dialog in the portal container provided by the PortalProvider", async () => {
      const container = ref<HTMLDivElement>();
      render(() => (
        <>
          <PortalProvider container={container}>
            <DialogTrigger>
              <Button>Delete…</Button>
              <Modal data-test="modal">
                <Dialog role="alertdialog" data-test="dialog">
                  {({ close }) => (
                    <>
                      <Heading slot="title">Alert</Heading>
                      <Text slot="description">This is the alert message.</Text>
                      <Button onPress={() => close()}>Close</Button>
                    </>
                  )}
                </Dialog>
              </Modal>
            </DialogTrigger>
          </PortalProvider>
          <div ref={container} data-testid="custom-container" />
        </>
      ));
      await user.click(screen().getByRole("button"));
      await settle();
      expect(screen().getByRole("alertdialog").closest('[data-testid="custom-container"]')).toBe(screen().getByTestId("custom-container"));
    });
  });

  // Rivet: the second open must render the content again (a lazy slot rendered once must not be lost).
  it("renders the content again on the second open", async () => {
    render(() => (
      <DialogTrigger>
        <Button>Open</Button>
        <Modal isDismissable>
          <Dialog>
            <Heading slot="title">Title</Heading>
            <Button slot="close">Close</Button>
          </Dialog>
        </Modal>
      </DialogTrigger>
    ));
    for (let i = 0; i < 2; i++) {
      await user.click(screen().getByRole("button", { name: "Open" }));
      await settle();
      const dialog = screen().getByRole("dialog");
      expect(within(dialog).getByRole("heading")).toHaveTextContent("Title");
      expect(dialog).toHaveAttribute("aria-labelledby", within(dialog).getByRole("heading").id);
      await user.click(within(dialog).getByRole("button", { name: "Close" }));
      await settle();
      expect(screen().queryByRole("dialog")).toBeNull();
    }
  });

  // Rivet: RA Overlay clears the trigger's PressResponder for the overlay content; without it the nested
  // trigger (and every Button in the dialog) also toggled the outer state.
  it("buttons inside the modal do not receive the trigger's press props; nested triggers open only their dialog", async () => {
    render(() => (
      <DialogTrigger>
        <Button>Outer</Button>
        <Modal isDismissable>
          <Dialog aria-label="Outer dialog">
            <input data-testid="auto" autoFocus />
            <DialogTrigger>
              <Button>Inner</Button>
              <Modal isDismissable>
                <Dialog aria-label="Inner dialog">Nested</Dialog>
              </Modal>
            </DialogTrigger>
          </Dialog>
        </Modal>
      </DialogTrigger>
    ));
    await user.click(screen().getByRole("button", { name: "Outer" }));
    await settle();
    expect(
      screen()
        .getAllByRole("dialog")
        .map((d) => d.getAttribute("aria-label")),
    ).toEqual(["Outer dialog"]);
    // React's autoFocus: the input is focused on mount, the dialog does not take focus.
    expect(document.activeElement).toBe(screen().getByTestId("auto"));
    const inner = screen().getByRole("button", { name: "Inner" });
    expect(inner).toHaveAttribute("aria-expanded", "false");
    expect(inner).not.toHaveAttribute("data-pressed");
    await user.click(inner);
    await settle();
    expect(screen().getByRole("dialog", { name: "Inner dialog" })).toBeInTheDocument();
    expect(screen().getByRole("dialog", { name: "Outer dialog" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await settle();
    expect(screen().queryByRole("dialog", { name: "Inner dialog" })).toBeNull();
    expect(screen().getByRole("dialog", { name: "Outer dialog" })).toBeInTheDocument();
  });

  // Rivet extension: DialogTrigger `trigger` modes (RAC vocabulary; C1b hover-trigger handlers).
  describe("trigger modes", () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    function Example(props: { trigger: "hover" | "focus" | "longPress"; description?: string }) {
      const trigger = props.trigger,
        description = props.description;
      return (
        <>
          <button type="button">Before</button>
          <DialogTrigger trigger={trigger} delay={50} closeDelay={0} longPressAccessibilityDescription={description}>
            <Button>Trigger</Button>
            <Popover>
              <Dialog aria-label="Popover dialog">Content</Dialog>
            </Popover>
          </DialogTrigger>
        </>
      );
    }

    it("hover: opens after the delay on mouse hover; leaving before the delay cancels", async () => {
      render(() => <Example trigger="hover" />);
      const button = screen().getByRole("button", { name: "Trigger" });
      await user.hover(button);
      await user.unhover(button);
      await wait(120);
      await settle();
      expect(screen().queryByRole("dialog")).toBeNull();
      await user.hover(button);
      expect(screen().queryByRole("dialog")).toBeNull();
      await wait(120);
      await settle();
      // The dialog takes focus (useDialog); focus within the overlay keeps it open, Escape closes.
      expect(screen().getByRole("dialog")).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-expanded", "true");
      await user.keyboard("{Escape}");
      await settle();
      expect(screen().queryByRole("dialog")).toBeNull();
    });

    it("hover: a mouse click does not toggle; keyboard press still toggles", async () => {
      render(() => <Example trigger="hover" />);
      const button = screen().getByRole("button", { name: "Trigger" });
      button.focus();
      await user.keyboard("{Enter}");
      await settle();
      expect(screen().getByRole("dialog")).toBeInTheDocument();
    });

    it("focus: keyboard focus opens", async () => {
      render(() => <Example trigger="focus" />);
      await user.tab();
      await user.tab();
      await settle();
      // Opened by keyboard focus; the dialog then takes focus (useDialog).
      expect(screen().getByRole("dialog")).toBeInTheDocument();
      expect(screen().getByRole("dialog").contains(document.activeElement)).toBe(true);
    });

    it("hover / focus: Escape restores focus to the trigger without reopening (docs bug D3-2)", async () => {
      for (const mode of ["hover", "focus"] as const) {
        render(() => <Example trigger={mode} />);
        const button = screen().getByRole("button", { name: "Trigger" });
        await user.tab();
        await user.tab();
        await settle();
        expect(screen().getByRole("dialog")).toBeInTheDocument();
        await user.keyboard("{Escape}");
        await settle();
        await wait(120);
        await settle();
        expect(document.activeElement).toBe(button);
        expect(screen().queryByRole("dialog")).toBeNull();
        // Focus leaving and coming back by keyboard opens again.
        await user.tab({ shift: true });
        await user.tab();
        await settle();
        expect(screen().getByRole("dialog")).toBeInTheDocument();
        await user.keyboard("{Escape}");
        await settle();
        cleanup();
      }
    });

    it("longPress: a short press does nothing, a long press opens; description", async () => {
      render(() => <Example trigger="longPress" description="Long press to open" />);
      const button = screen().getByRole("button", { name: "Trigger" });
      expect(document.getElementById(button.getAttribute("aria-describedby")!)).toHaveTextContent("Long press to open");
      await user.click(button);
      await settle();
      expect(screen().queryByRole("dialog")).toBeNull();
      await user.pointer({ keys: "[MouseLeft>]", target: button });
      await wait(600);
      await settle();
      expect(screen().getByRole("dialog")).toBeInTheDocument();
      await user.pointer({ keys: "[/MouseLeft]", target: button });
    });
  });
});
