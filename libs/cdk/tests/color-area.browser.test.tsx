// Ported from react-aria-components test/ColorArea.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isFocusVisible()`); `jest.fn` → `vi.fn`;
// `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`; default classes `rv-ColorArea` / `rv-ColorThumb`;
// "should support dragging state": `fireEvent.mouseDown/mouseUp` → `pointerdown` on the thumb / `pointerup` on window
// (Chromium has PointerEvent, so upstream's mouse fallback path is not taken; jsdom has none).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: two-way Signal `value`, onChange / onChangeEnd on drag, keyboard arrows, hidden form inputs (xName / yName).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ColorArea, ColorAreaContext, type ColorAreaProps } from "../color-area/index.tsx";
import { ColorThumb, type ColorThumbProps } from "../color-thumb/index.tsx";
import { parseColor, type Color } from "../color/index.ts";

afterEach(cleanup);

function TestColorArea(props: { sliderProps?: Partial<ColorAreaProps>; thumbProps?: ColorThumbProps }) {
  return (
    <ColorArea defaultValue="rgb(255, 0, 0)" xChannel="red" yChannel="green" {...props.sliderProps}>
      <ColorThumb {...props.thumbProps} />
    </ColorArea>
  );
}

const renderColorArea = (sliderProps?: Partial<ColorAreaProps>, thumbProps?: ColorThumbProps) => {
  const { container } = render(() => <TestColorArea sliderProps={sliderProps} thumbProps={thumbProps} />);
  return within(container as HTMLElement);
};

const pointer = (type: string, target: EventTarget, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init }));

describe("ColorArea", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a color area with default class", () => {
    const { getByRole } = renderColorArea();
    const group = getByRole("group");
    expect(group).toHaveAttribute("class", "rv-ColorArea");
    expect(group.querySelector(".rv-ColorThumb")).toBeInTheDocument();
  });

  it("should render a slider with custom class", () => {
    const { getByRole } = renderColorArea({ class: "test" });
    const group = getByRole("group");
    expect(group).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderColorArea({ "data-foo": "bar" }, { "data-bar": "foo" });
    const group = getByRole("group");
    expect(group).toHaveAttribute("data-foo", "bar");
    expect(group.querySelector(".rv-ColorThumb")).toHaveAttribute("data-bar", "foo");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support render props", () => {
    const { container } = render(() => (
      <ColorArea isDisabled defaultValue="rgb(255, 0, 0)" xChannel="red" yChannel="green">
        {({ isDisabled }) => (
          <div class={isDisabled() ? "disabled" : ""} data-testid="wrapper">
            <ColorThumb />
          </div>
        )}
      </ColorArea>
    ));
    expect(within(container as HTMLElement).getByTestId("wrapper")).toHaveClass("disabled");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={ColorAreaContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestColorArea sliderProps={{ slot: "test" }} />
      </Provider>
    ));
    const { getByRole } = within(container as HTMLElement);
    const group = getByRole("group");
    expect(group).toHaveAttribute("slot", "test");
    expect(getByRole("slider")).toHaveAttribute("aria-label", "test, Color picker");
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderColorArea({}, { class: ({ isFocusVisible }) => `thumb ${isFocusVisible() ? "focus" : ""}` });
    const slider = getByRole("slider");
    const thumb = slider.closest(".thumb")!;

    expect(thumb).not.toHaveAttribute("data-focus-visible");
    expect(thumb).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(slider);
    expect(thumb).toHaveAttribute("data-focus-visible", "true");
    expect(thumb).toHaveClass("focus");

    await user.tab();
    expect(thumb).not.toHaveAttribute("data-focus-visible");
    expect(thumb).not.toHaveClass("focus");
  });

  it("should support dragging state", () => {
    const { getByRole } = renderColorArea({}, { class: ({ isDragging }) => `thumb ${isDragging() ? "dragging" : ""}` });
    const thumb = getByRole("slider").closest(".thumb")!;

    expect(thumb).not.toHaveAttribute("data-dragging");
    expect(thumb).not.toHaveClass("dragging");

    pointer("pointerdown", thumb);
    expect(thumb).toHaveAttribute("data-dragging", "true");
    expect(thumb).toHaveClass("dragging");

    pointer("pointerup", thumb);
    expect(thumb).not.toHaveAttribute("data-dragging");
    expect(thumb).not.toHaveClass("dragging");
  });

  it("should support hover state", async () => {
    const hoverStartThumbSpy = vi.fn();
    const hoverChangeThumbSpy = vi.fn();
    const hoverEndThumbSpy = vi.fn();
    const { getByRole } = renderColorArea(
      {},
      {
        class: ({ isHovered }) => `thumb ${isHovered() ? "hovered" : ""}`,
        onHoverStart: hoverStartThumbSpy,
        onHoverChange: hoverChangeThumbSpy,
        onHoverEnd: hoverEndThumbSpy,
      },
    );
    const thumb = getByRole("slider").closest(".thumb")!;

    expect(thumb).not.toHaveAttribute("data-hovered");
    expect(thumb).not.toHaveClass("hovered");

    await user.hover(thumb);
    expect(thumb).toHaveAttribute("data-hovered", "true");
    expect(thumb).toHaveClass("hovered");
    expect(hoverStartThumbSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeThumbSpy).toHaveBeenCalledTimes(1);

    await user.unhover(thumb);
    expect(thumb).not.toHaveAttribute("data-hovered");
    expect(thumb).not.toHaveClass("hovered");
    expect(hoverEndThumbSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeThumbSpy).toHaveBeenCalledTimes(2);
  });

  it("should support disabled state", () => {
    const { getByRole } = renderColorArea(
      { isDisabled: true, class: ({ isDisabled }) => (isDisabled() ? "disabled" : "") },
      { class: ({ isDisabled }) => `thumb ${isDisabled() ? "disabled" : ""}` },
    );
    const wrapper = getByRole("group");
    const slider = getByRole("slider");
    const thumb = slider.closest(".thumb")!;

    expect(slider).toBeDisabled();
    expect(thumb).toHaveAttribute("data-disabled", "true");
    expect(thumb).toHaveClass("disabled");

    expect(wrapper).toHaveAttribute("data-disabled", "true");
    expect(wrapper).toHaveClass("disabled");
  });

  it("should support repeat keydown events when holding Page Up/Page Down", async () => {
    // Page Up/Down adjust the Y (green) channel; the arrow keys are handled by useMove instead. The page step is 17.
    const { getAllByRole } = renderColorArea();
    const greenSlider = getAllByRole("slider", { hidden: true })[1];

    await user.tab();
    await user.keyboard("{PageUp>3/}");
    expect(greenSlider).toHaveValue("51");

    await user.keyboard("{PageDown>3/}");
    expect(greenSlider).toHaveValue("0");
  });

  it("should support form prop", () => {
    const { getByRole } = renderColorArea({ form: "test" });
    const input = getByRole("slider");
    expect(input).toHaveAttribute("form", "test");
  });

  // Rivet additions
  it("updates a two-way Signal value from the keyboard (arrows step, Shift = page step)", async () => {
    const value = signal<string | Color>(parseColor("rgb(0, 0, 0)"));
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    const { container } = render(() => (
      <ColorArea value={value} xChannel="red" yChannel="green" onChange={onChange} onChangeEnd={onChangeEnd} xName="red" yName="green">
        <ColorThumb />
      </ColorArea>
    ));
    const [x, y] = within(container as HTMLElement).getAllByRole("slider", { hidden: true }) as HTMLInputElement[];
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect((value() as Color).toString("rgb")).toBe("rgb(1, 0, 0)");
    expect(x!.value).toBe("1");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect((value() as Color).toString("rgb")).toBe("rgb(1, 17, 0)");
    expect(y!.value).toBe("17");
    expect(x!.name).toBe("red");
    expect(y!.name).toBe("green");
  });

  it("sets the color from a pointer press on the area and drags the thumb", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    const { container } = render(() => (
      <ColorArea
        defaultValue="rgb(0, 0, 0)"
        xChannel="red"
        yChannel="green"
        onChange={onChange}
        onChangeEnd={onChangeEnd}
        style={{ width: "255px", height: "255px" }}
      >
        <ColorThumb />
      </ColorArea>
    ));
    const group = within(container as HTMLElement).getByRole("group");
    const rect = group.getBoundingClientRect();
    pointer("pointerdown", group, { clientX: rect.x + 255 / 2, clientY: rect.y + 255 / 2 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const first = onChange.mock.calls[0]![0] as Color;
    expect(first.getChannelValue("red")).toBe(128);
    expect(first.getChannelValue("green")).toBe(128);
    pointer("pointermove", window, { clientX: rect.x + 255, clientY: rect.y + 255 / 2 });
    const moved = onChange.mock.calls.at(-1)![0] as Color;
    expect(moved.getChannelValue("red")).toBe(255);
    pointer("pointerup", window, { clientX: rect.x + 255, clientY: rect.y + 255 / 2 });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect((onChangeEnd.mock.calls[0]![0] as Color).getChannelValue("red")).toBe(255);
  });

  it("renders the gradient background and thumb position as inline styles", () => {
    const { getByRole } = renderColorArea();
    const group = getByRole("group");
    expect(group.style.background).toContain("linear-gradient");
    expect(group.style.touchAction).toBe("none");
    const thumb = group.querySelector(".rv-ColorThumb") as HTMLElement;
    expect(thumb.style.left).toBe("100%");
    expect(thumb.style.top).toBe("100%");
    expect(thumb.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });
});
