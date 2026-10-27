// Ported from react-aria-components test/DropZone.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium, real `DataTransfer` / `DragEvent` / `ClipboardEvent`
// instead of the jsdom mocks); `getByTestId` / `getByRole` → `@testing-library/dom` `within(container)`; default class
// `rv-DropZone`; `React.createRef()` → Rivet `ref()`; `jest.fn` → `vi.fn`. The upstream `Draggable` source is replaced
// by a native `DataTransfer` filled before `dragenter`, `effectAllowed` "all" (a drag from another app / page; shadowed: Chromium
// keeps a constructed DataTransfer at "none") → first allowed operation "move"; a Rivet drag source is the DnD lane). Not ported (DnD lane, see `drop-zone/index.tsx`):
// "via keyboard" (virtual drag session). The paste tests dispatch `beforepaste` / `paste` on the hidden button (it handles
// them itself; upstream listens on the document).
import { afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { DropZone, DropZoneContext } from "../drop-zone/index.tsx";
import { FileTrigger } from "../file-trigger/index.tsx";
import { Link } from "../link/index.tsx";
import { Text } from "../text/index.tsx";
import { Provider } from "@rivetjs/runtime/dom";

afterEach(cleanup);

const screen = (container: Element | DocumentFragment) => within(container as HTMLElement);

// Chromium ignores `effectAllowed` / `dropEffect` writes on a constructed DataTransfer outside a real drag: shadow them
// with own data properties (what a drag from another app reports: "all").
function allowAll(dataTransfer: DataTransfer): DataTransfer {
  Object.defineProperty(dataTransfer, "effectAllowed", { value: "all", writable: true });
  Object.defineProperty(dataTransfer, "dropEffect", { value: "none", writable: true });
  return dataTransfer;
}

function drag(el: Element, type: string, dataTransfer: DataTransfer, x: number, y: number): boolean {
  return el.dispatchEvent(new DragEvent(type, { dataTransfer, clientX: x, clientY: y, bubbles: true, cancelable: true }));
}

describe("DropZone", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a dropzone", () => {
    const { container } = render(() => (
      <DropZone data-testid="foo">
        <Text slot="label">Test</Text>
      </DropZone>
    ));
    expect(screen(container).getByTestId("foo")).toHaveAttribute("class", "rv-DropZone");
  });

  it("should render a dropzone with custom class", () => {
    const { container } = render(() => (
      <DropZone data-testid="foo" class="test">
        <Text slot="label">Test</Text>
      </DropZone>
    ));
    expect(screen(container).getByTestId("foo")).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { container } = render(() => (
      <DropZone data-testid="foo" data-foo="bar">
        <Text slot="label">Test</Text>
      </DropZone>
    ));
    expect(screen(container).getByTestId("foo")).toHaveAttribute("data-foo", "bar");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={DropZoneContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <DropZone data-testid="foo" slot="test" />
      </Provider>
    ));
    const dropzone = screen(container).getByTestId("foo");
    expect(dropzone).toHaveAttribute("class", "rv-DropZone");
    expect(dropzone).toHaveAttribute("slot", "test");
    expect(screen(container).getByRole("button")).toHaveAttribute("aria-label", "test");
  });

  it("should support custom render function", () => {
    const { container } = render(() => (
      <DropZone data-testid="foo" render={(props) => <div {...(props as object)} data-custom="true" />}>
        <Text slot="label">Test</Text>
      </DropZone>
    ));
    expect(screen(container).getByTestId("foo")).toHaveAttribute("data-custom", "true");
  });

  it("should support hover", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { container } = render(() => (
      <DropZone
        data-testid="foo"
        class={({ isHovered }) => (isHovered() ? "hover" : "")}
        onHoverStart={hoverStartSpy}
        onHoverChange={hoverChangeSpy}
        onHoverEnd={hoverEndSpy}
      >
        Test
      </DropZone>
    ));
    const dropzone = screen(container).getByTestId("foo");
    expect(dropzone).not.toHaveAttribute("data-hovered");
    expect(dropzone).not.toHaveClass("hover");
    await user.hover(dropzone);
    await flush();
    expect(dropzone).toHaveAttribute("data-hovered", "true");
    expect(dropzone).toHaveClass("hover");
    expect(hoverStartSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(1);
    await user.unhover(dropzone);
    await flush();
    expect(dropzone).not.toHaveAttribute("data-hovered");
    expect(dropzone).not.toHaveClass("hover");
    expect(hoverEndSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(2);
  });

  it("should support focus ring", async () => {
    const { container } = render(() => (
      <DropZone data-testid="foo" class={({ isFocusVisible }) => (isFocusVisible() ? "focus" : "")}>
        <Text slot="label">Test</Text>
      </DropZone>
    ));
    const dropzone = screen(container).getByTestId("foo");
    const button = screen(container).getByRole("button");
    expect(dropzone).not.toHaveAttribute("data-focus-visible");
    expect(dropzone).not.toHaveClass("focus");
    await user.tab();
    await flush();
    expect(document.activeElement).toBe(button);
    expect(dropzone).toHaveAttribute("data-focus-visible", "true");
    expect(dropzone).toHaveClass("focus");
    await user.tab();
    await flush();
    expect(dropzone).not.toHaveAttribute("data-focus-visible");
    expect(dropzone).not.toHaveClass("focus");
  });

  it("should apply correct default aria-labelledby", () => {
    const { container } = render(() => (
      <DropZone class="test">
        <Text slot="label">Test</Text>
      </DropZone>
    ));
    const text = screen(container).getByText("Test");
    const button = screen(container).getByRole("button");
    expect(button).toHaveAttribute("aria-labelledby", `${button.id} ${text.id}`);
    // The button's own id lists its `aria-label` ("DropZone") before the label text (RA useLabels).
    expect(button).toHaveAccessibleName("DropZone Test");
  });

  it("should allow custom aria-label", () => {
    const { container } = render(() => (
      <DropZone data-testid="foo" aria-label="test aria-label">
        <FileTrigger>
          <Link>Upload</Link>
        </FileTrigger>
      </DropZone>
    ));
    expect(screen(container).getByRole("button")).toHaveAttribute("aria-label", "test aria-label");
  });

  it("should support render props", async () => {
    const { container } = render(() => (
      <DropZone data-testid="foo">
        {({ isFocused }) =>
          () =>
            isFocused() ? "Focused" : "Not Focused"
          }
      </DropZone>
    ));
    const dropzone = screen(container).getByTestId("foo");
    expect(dropzone).toHaveTextContent("Not Focused");
    await user.tab();
    await flush();
    expect(dropzone).toHaveTextContent("Focused");
  });

  it("should render FileTrigger as a child", () => {
    const { container } = render(() => (
      <DropZone>
        <FileTrigger>
          <Button data-testid="foo">Upload</Button>
        </FileTrigger>
      </DropZone>
    ));
    expect(screen(container).getByTestId("foo")).toHaveClass("rv-Button");
  });

  it("should attach a ref to the dropzone if provided as a prop", async () => {
    const r = ref<HTMLDivElement>();
    const { container } = render(() => (
      <DropZone data-testid="foo" ref={r}>
        <FileTrigger>
          <Button>Upload</Button>
        </FileTrigger>
      </DropZone>
    ));
    await flush();
    expect(r()).toBe(screen(container).getByTestId("foo"));
  });

  describe("drag and drop", () => {
    describe("via mouse", () => {
      it("should support data attribute drop-target", async () => {
        const onDropEnter = vi.fn();
        const onDropMove = vi.fn();
        const onDropExit = vi.fn();
        const onDrop = vi.fn();
        const { container } = render(() => (
          <DropZone data-testid="foo" onDropEnter={onDropEnter} onDrop={onDrop} onDropMove={onDropMove} onDropExit={onDropExit}>
            <Text slot="label">Test</Text>
          </DropZone>
        ));
        const dropzone = screen(container).getByTestId("foo");
        const rect = dropzone.getBoundingClientRect();
        expect(dropzone).not.toHaveAttribute("data-drop-target");
        const dataTransfer = allowAll(new DataTransfer());
        dataTransfer.items.add("hello world", "text/plain");
        expect(drag(dropzone, "dragenter", dataTransfer, rect.x + 1, rect.y + 1)).toBe(false);
        expect(onDropEnter).toHaveBeenCalledTimes(1);
        expect(onDropEnter).toHaveBeenCalledWith({ type: "dropenter", x: 1, y: 1 });
        expect(dataTransfer.dropEffect).toBe("move");
        expect(dropzone).toHaveAttribute("data-drop-target", "true");

        expect(drag(dropzone, "dragover", dataTransfer, rect.x + 2, rect.y + 2)).toBe(false);
        expect(onDropMove).toHaveBeenCalledTimes(1);
        expect(onDropMove).toHaveBeenCalledWith({ type: "dropmove", x: 2, y: 2 });
        expect(dataTransfer.dropEffect).toBe("move");
        expect(dropzone).toHaveAttribute("data-drop-target", "true");

        drag(dropzone, "drop", dataTransfer, rect.x + 2, rect.y + 2);
        expect(onDrop).toHaveBeenCalledTimes(1);
        const event = onDrop.mock.calls[0]![0];
        expect(event).toMatchObject({ type: "drop", x: 2, y: 2, dropOperation: "move" });
        expect(event.items).toHaveLength(1);
        expect(event.items[0].kind).toBe("text");
        expect(event.items[0].types).toEqual(new Set(["text/plain"]));
        expect(await event.items[0].getText("text/plain")).toBe("hello world");
        expect(onDropExit).toHaveBeenCalledTimes(1);
        expect(dropzone).not.toHaveAttribute("data-drop-target");
      });

      it("should report dropped files and leave on dragleave", async () => {
        // A constructed DataTransfer's file items have no file system entry in Chromium (`webkitGetAsEntry()` = null, which
        // readFromDataTransfer skips as Firefox's phantom item): read them through `getAsFile()` as in jsdom upstream.
        const proto = DataTransferItem.prototype as unknown as Record<string, unknown>;
        const entry = Object.getOwnPropertyDescriptor(proto, "webkitGetAsEntry")!;
        Object.defineProperty(proto, "webkitGetAsEntry", { value: undefined, configurable: true });
        onTestFinished(() => void Object.defineProperty(proto, "webkitGetAsEntry", entry));
        const onDrop = vi.fn();
        const onDropExit = vi.fn();
        const { container } = render(() => (
          <DropZone data-testid="foo" onDrop={onDrop} onDropExit={onDropExit} getDropOperation={(types) => (types.has("image/*") ? "copy" : "cancel")}>
            <Text slot="label">Images</Text>
          </DropZone>
        ));
        const dropzone = screen(container).getByTestId("foo");
        // A non-image drag: cancel, no drop target.
        const text = allowAll(new DataTransfer());
        text.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
        drag(dropzone, "dragenter", text, 1, 1);
        expect(text.dropEffect).toBe("none");
        expect(dropzone).not.toHaveAttribute("data-drop-target");
        drag(dropzone, "dragleave", text, 1, 1);
        // An image: copy.
        const image = allowAll(new DataTransfer());
        image.items.add(new File(["png"], "cat.png", { type: "image/png" }));
        drag(dropzone, "dragenter", image, 1, 1);
        expect(image.dropEffect).toBe("copy");
        expect(dropzone).toHaveAttribute("data-drop-target", "true");
        drag(dropzone, "dragleave", image, 1, 1);
        expect(dropzone).not.toHaveAttribute("data-drop-target");
        expect(onDropExit).toHaveBeenCalledTimes(1);
        drag(dropzone, "dragenter", image, 1, 1);
        drag(dropzone, "drop", image, 1, 1);
        const event = onDrop.mock.calls[0]![0];
        expect(event.dropOperation).toBe("copy");
        expect(event.items[0]).toMatchObject({ kind: "file", type: "image/png", name: "cat.png" });
        expect(await (await event.items[0].getFile()).text()).toBe("png");
      });

      it("enters on a dragover with no recorded dragenter (Rivet: resumed page, the enter loaded the code)", () => {
        const onDropEnter = vi.fn();
        const { container } = render(() => (
          <DropZone data-testid="foo" onDropEnter={onDropEnter}>
            <Text slot="label">Test</Text>
          </DropZone>
        ));
        const dropzone = screen(container).getByTestId("foo");
        const dataTransfer = allowAll(new DataTransfer());
        dataTransfer.items.add("hello world", "text/plain");
        expect(drag(dropzone, "dragover", dataTransfer, 3, 3)).toBe(false);
        expect(onDropEnter).toHaveBeenCalledTimes(1);
        expect(dropzone).toHaveAttribute("data-drop-target", "true");
        drag(dropzone, "dragover", dataTransfer, 4, 4);
        expect(onDropEnter).toHaveBeenCalledTimes(1);
        drag(dropzone, "dragleave", dataTransfer, 4, 4);
        expect(dropzone).not.toHaveAttribute("data-drop-target");
      });

      it("should not trigger drag events if disabled", () => {
        const onDropEnter = vi.fn();
        const onDropMove = vi.fn();
        const onDrop = vi.fn();
        const { container } = render(() => (
          <DropZone isDisabled data-testid="disabled" onDropEnter={onDropEnter} onDrop={onDrop} onDropMove={onDropMove}>
            <Text slot="label">Test</Text>
          </DropZone>
        ));
        const dropzone = screen(container).getByTestId("disabled");
        expect(dropzone).toHaveAttribute("data-disabled", "true");
        expect(dropzone).not.toHaveAttribute("data-drop-target");
        const dataTransfer = allowAll(new DataTransfer());
        dataTransfer.items.add("hello world", "text/plain");
        expect(drag(dropzone, "dragenter", dataTransfer, 1, 1)).toBe(true);
        expect(onDropEnter).toHaveBeenCalledTimes(0);
        expect(dataTransfer.dropEffect).toBe("none");
        expect(dropzone).not.toHaveAttribute("data-drop-target");
        drag(dropzone, "dragover", dataTransfer, 2, 2);
        expect(onDropMove).toHaveBeenCalledTimes(0);
        expect(dropzone).not.toHaveAttribute("data-drop-target");
      });

      it("should focus the dropzone visually hidden button if click happens on a non-focusable element", async () => {
        const { container } = render(() => (
          <DropZone data-testid="dropzone">
            <div data-testid="div">Test</div>
          </DropZone>
        ));
        const hiddenButton = screen(container).getByRole("button");
        await user.click(screen(container).getByTestId("div"));
        expect(document.activeElement).toBe(hiddenButton);
        expect(screen(container).getByTestId("dropzone")).toContainElement(document.activeElement as HTMLElement);
      });

      it("when a focusable element in the drop zone is clicked, it should receive focus", async () => {
        const { container } = render(() => (
          <DropZone data-testid="dropzone">
            <Button data-testid="button">Test</Button>
          </DropZone>
        ));
        const button = screen(container).getByTestId("button");
        await user.click(button);
        expect(document.activeElement).toBe(button);
      });
    });
  });

  describe("useClipboard", () => {
    it("should be able to paste items into the dropzone", async () => {
      const onDrop = vi.fn();
      const { container } = render(() => (
        <DropZone onDrop={onDrop}>
          <Text slot="label">Test</Text>
        </DropZone>
      ));
      const button = screen(container).getByRole("button");
      await user.tab();
      expect(document.activeElement).toBe(button);
      const clipboardData = new DataTransfer();
      clipboardData.items.add("hello world", "text/plain");
      const allowDefaultPaste = button.dispatchEvent(new ClipboardEvent("beforepaste", { clipboardData, bubbles: true, cancelable: true }));
      expect(allowDefaultPaste).toBe(false);
      button.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
      expect(onDrop).toHaveBeenCalledTimes(1);
      expect(onDrop).toHaveBeenCalledWith({ type: "drop", x: 0, y: 0, dropOperation: "copy", items: expect.any(Array) });
      expect(await onDrop.mock.calls[0]![0].items[0].getText("text/plain")).toBe("hello world");
    });

    it("should not allow paste into the dropzone if disabled", async () => {
      const onDrop = vi.fn();
      const { container } = render(() => (
        <DropZone isDisabled onDrop={onDrop}>
          <Text slot="label">Cannot paste here</Text>
        </DropZone>
      ));
      const button = screen(container).getByRole("button");
      expect(button).toBeDisabled();
      await user.tab();
      expect(document.activeElement).not.toBe(button);
      const clipboardData = new DataTransfer();
      clipboardData.items.add("hello world", "text/plain");
      button.dispatchEvent(new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }));
      expect(onDrop).toHaveBeenCalledTimes(0);
    });
  });
});
