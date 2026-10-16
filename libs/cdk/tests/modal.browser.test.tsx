// Ported from react-aria-components (packages/react-aria-components/test/Modal.browser.test.tsx), react-spectrum,
// Apache-2.0, © Adobe.
// Changes: `render` from `@rivetjs/runtime/testing`; the upstream custom browser command
// `mouseDownOnElement` (trusted mousedown held down, Chrome moves focus to <body>) has no counterpart in
// this vitest config: the press is a dispatched pointerdown / mousedown on the backdrop followed by the
// native focus move it causes in Chrome (`activeElement.blur()` → <body>). FocusScope containment must
// restore focus to the Dialog without scrolling.
import { afterEach, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Heading } from "../heading/index.tsx";
import { Dialog, DialogTrigger } from "../dialog/index.tsx";
import { Modal, ModalOverlay } from "../modal/index.tsx";

const OFFSET_VH = 5;
const screen = () => within(document.body);
afterEach(() => cleanup());

function ScrollJumpExample() {
  const rows = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <DialogTrigger>
      <Button>Open modal</Button>
      <ModalOverlay
        isDismissable
        data-testid="scroll-jump-backdrop"
        style={{
          position: "fixed",
          inset: "0",
          zIndex: 100,
          display: "flex",
          justifyContent: "center",
          overflowY: "auto",
          background: "rgba(0, 0, 0, 0.7)",
        }}
      >
        <Modal
          data-testid="scroll-jump-modal"
          style={{ marginTop: `${OFFSET_VH}dvh`, minHeight: `${100 - OFFSET_VH}dvh`, width: "100%", maxWidth: "42rem", background: "white" }}
        >
          <Dialog data-testid="scroll-jump-dialog" style={{ display: "flex", minHeight: "100%", flexDirection: "column", padding: "2rem", outline: "none" }}>
            <Heading slot="title">Modal in a scrollable overlay</Heading>
            {rows.map((i) => (
              <div style={{ height: "10rem", flexShrink: 0 }}>{i}</div>
            ))}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

// mousedown on the backdrop moves focus to <body> in Chrome/Safari; Firefox does not.
// FocusScope containment must restore focus to the Dialog without scrolling,
// otherwise the modal visibly jumps to the top of the screen.
it("does not scroll the modal into view when the backdrop is pressed", async () => {
  const user = userEvent.setup({ delay: null });
  render(() => <ScrollJumpExample />);

  await user.click(screen().getByRole("button", { name: "Open modal" }));
  for (let i = 0; i < 3; i++) await flush();
  expect(screen().getByRole("dialog")).toBeInTheDocument();

  const overlay = screen().getByTestId("scroll-jump-backdrop");
  const modal = screen().getByTestId("scroll-jump-modal");

  overlay.scrollTop = 0;
  const modalTopBefore = Math.round(modal.getBoundingClientRect().top);
  expect(overlay.scrollTop).toBe(0);
  expect(modalTopBefore).toBeGreaterThan(0);

  // Press (do not release) on the backdrop, then Chrome's native focus move to <body>.
  const rect = overlay.getBoundingClientRect();
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + 5,
    clientY: rect.top + 5,
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  };
  overlay.dispatchEvent(new PointerEvent("pointerdown", init));
  overlay.dispatchEvent(new MouseEvent("mousedown", init));
  (document.activeElement as HTMLElement | null)?.blur();

  // Wait a couple frames for FocusScope's requestAnimationFrame focus restore to run.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));

  // the modal stays at its offset
  expect(overlay.scrollTop).toBe(0);
  expect(Math.round(modal.getBoundingClientRect().top)).toBe(modalTopBefore);

  overlay.dispatchEvent(new PointerEvent("pointerup", init));
  overlay.dispatchEvent(new MouseEvent("mouseup", init));
});
