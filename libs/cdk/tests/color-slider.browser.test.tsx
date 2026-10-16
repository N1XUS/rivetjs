// Ported from react-aria-components test/ColorSlider.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isFocusVisible()`); `jest.fn` → `vi.fn`;
// `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`; default classes `rv-*`;
// "should support dragging state": `fireEvent.mouseDown/mouseUp` → `pointerdown` / `pointerup` (Chromium has
// PointerEvent, so upstream's mouse fallback path is not taken; jsdom has none).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files).
// Rivet additions: keyboard on a two-way Signal, track press + drag, output / value text of HSL channels, gradients.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ColorSlider, ColorSliderContext, type ColorSliderProps } from "../color-slider/index.tsx";
import { ColorThumb, type ColorThumbProps } from "../color-thumb/index.tsx";
import { Label } from "../label/index.tsx";
import { SliderOutput, SliderTrack, type SliderOutputProps, type SliderTrackProps } from "../slider/index.tsx";
import { toColor, type Color } from "../color/index.ts";

afterEach(cleanup);

interface TestProps {
  sliderProps?: Partial<ColorSliderProps>;
  thumbProps?: ColorThumbProps;
  trackProps?: SliderTrackProps;
  outputProps?: SliderOutputProps;
}

const TestColorSlider = ({ sliderProps, thumbProps, trackProps, outputProps }: TestProps) => (
  <ColorSlider defaultValue="rgb(255, 0, 0)" channel="red" {...sliderProps}>
    <Label />
    <SliderOutput {...outputProps} />
    <SliderTrack {...trackProps}>
      <ColorThumb {...thumbProps} />
    </SliderTrack>
  </ColorSlider>
);

const renderSlider = (sliderProps?: Partial<ColorSliderProps>, thumbProps?: ColorThumbProps, trackProps?: SliderTrackProps, outputProps?: SliderOutputProps) =>
  within(render(() => <TestColorSlider {...{ sliderProps, thumbProps, trackProps, outputProps }} />).container as HTMLElement);

const pointer = (type: string, target: EventTarget, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init }));

describe("ColorSlider", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a slider with default class", () => {
    const { getByRole } = renderSlider();
    const group = getByRole("group");
    expect(group).toHaveAttribute("class", "rv-SliderTrack");
    expect(group.parentElement).toHaveAttribute("class", "rv-ColorSlider");
    expect(group).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)).toHaveTextContent("Red");
    expect(getByRole("status")).toHaveTextContent("255");
    expect(group.querySelector(".rv-ColorThumb")).toBeInTheDocument();
  });

  it("should render a slider with custom class", () => {
    const { getByRole } = renderSlider({ class: "test" });
    expect(getByRole("group").parentElement).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderSlider(
      { "data-foo": "bar" } as never,
      { "data-bar": "foo" } as never,
      { "data-test": "test" } as never,
      { "data-output": "output" } as never,
    );
    const slider = getByRole("group").parentElement!;
    expect(slider).toHaveAttribute("data-foo", "bar");
    expect(slider.querySelector(".rv-ColorThumb")).toHaveAttribute("data-bar", "foo");
    expect(slider.querySelector(".rv-SliderTrack")).toHaveAttribute("data-test", "test");
    expect(slider.querySelector(".rv-SliderOutput")).toHaveAttribute("data-output", "output");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support render props", () => {
    const { container } = render(() => (
      <ColorSlider orientation="vertical" defaultValue="rgb(255, 0, 0)" channel="red">
        {({ orientation }) => (
          <div class={`slider-${orientation()}`} data-testid="wrapper">
            <Label />
            <SliderOutput />
            <SliderTrack>
              <ColorThumb />
            </SliderTrack>
          </div>
        )}
      </ColorSlider>
    ));
    expect(within(container as HTMLElement).getByTestId("wrapper")).toHaveClass("slider-vertical");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={ColorSliderContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestColorSlider sliderProps={{ slot: "test" }} />
      </Provider>
    ));
    const group = within(container as HTMLElement).getByRole("group");
    expect(group.parentElement).toHaveAttribute("slot", "test");
    expect(group).toHaveAttribute("aria-label", "test");
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderSlider({}, { class: ({ isFocusVisible }) => `thumb ${isFocusVisible() ? "focus" : ""}` });
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
    const { getByRole } = renderSlider({}, { class: ({ isDragging }) => `thumb ${isDragging() ? "dragging" : ""}` });
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
    const hoverStartTrackSpy = vi.fn();
    const hoverChangeTrackSpy = vi.fn();
    const hoverEndTrackSpy = vi.fn();
    const hoverStartThumbSpy = vi.fn();
    const hoverChangeThumbSpy = vi.fn();
    const hoverEndThumbSpy = vi.fn();
    const { getByRole } = renderSlider(
      {},
      {
        class: ({ isHovered }) => `thumb ${isHovered() ? "hovered" : ""}`,
        onHoverStart: hoverStartThumbSpy,
        onHoverChange: hoverChangeThumbSpy,
        onHoverEnd: hoverEndThumbSpy,
      },
      {
        class: ({ isHovered }) => `track ${isHovered() ? "hovered" : ""}`,
        onHoverStart: hoverStartTrackSpy,
        onHoverChange: hoverChangeTrackSpy,
        onHoverEnd: hoverEndTrackSpy,
      },
    );
    const thumb = getByRole("slider").closest(".thumb")!;
    const track = getByRole("slider").closest(".track")!;

    expect(thumb).not.toHaveAttribute("data-hovered");
    expect(thumb).not.toHaveClass("hovered");
    expect(track).not.toHaveAttribute("data-hovered");
    expect(track).not.toHaveClass("hovered");

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

    await user.hover(track);
    expect(track).toHaveAttribute("data-hovered", "true");
    expect(track).toHaveClass("hovered");
    expect(hoverStartTrackSpy).toHaveBeenCalledTimes(2);
    expect(hoverChangeTrackSpy).toHaveBeenCalledTimes(3);

    await user.unhover(track);
    expect(track).not.toHaveAttribute("data-hovered");
    expect(track).not.toHaveClass("hovered");
    expect(hoverEndTrackSpy).toHaveBeenCalledTimes(2);
    expect(hoverChangeTrackSpy).toHaveBeenCalledTimes(4);
  });

  it("should support disabled state", () => {
    const { getByRole } = renderSlider(
      { isDisabled: true, class: ({ isDisabled }) => (isDisabled() ? "disabled" : "") },
      { class: ({ isDisabled }) => `thumb ${isDisabled() ? "disabled" : ""}` },
    );
    const wrapper = getByRole("group").parentElement!;
    const slider = getByRole("slider");
    const thumb = slider.closest(".thumb")!;

    expect(slider).toBeDisabled();
    expect(thumb).toHaveAttribute("data-disabled", "true");
    expect(thumb).toHaveClass("disabled");

    expect(wrapper).toHaveAttribute("data-disabled", "true");
    expect(wrapper).toHaveClass("disabled");
  });

  it("should support orientation", () => {
    const { getByRole } = renderSlider({ orientation: "vertical", class: ({ orientation }) => orientation() });
    const wrapper = getByRole("group").parentElement!;
    const slider = getByRole("slider");

    expect(wrapper).toHaveAttribute("data-orientation", "vertical");
    expect(wrapper).toHaveClass("vertical");
    expect(slider).toHaveAttribute("aria-orientation", "vertical");
  });

  it("should support form prop", () => {
    const { getByRole } = renderSlider({ form: "test" });
    expect(getByRole("slider")).toHaveAttribute("form", "test");
  });

  // Rivet additions
  it("moves the channel with the arrow keys / Page keys and updates a two-way Signal", async () => {
    const value = signal<string | Color>("rgb(100, 0, 0)");
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    const { getByRole } = renderSlider({ value, defaultValue: undefined, onChange, onChangeEnd, name: "red" });
    const input = getByRole("slider") as HTMLInputElement;
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(toColor(value())!.getChannelValue("red")).toBe(101);
    expect(input.value).toBe("101");
    expect(getByRole("status")).toHaveTextContent("101");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    await user.keyboard("{PageUp}");
    expect(toColor(value())!.getChannelValue("red")).toBe(118);
    await user.keyboard("{End}");
    expect(toColor(value())!.getChannelValue("red")).toBe(255);
    expect(input.name).toBe("red");
  });

  it("formats the output and value text of HSL channels like the color (hue name, percent)", () => {
    const hue = renderSlider({ defaultValue: "hsl(0, 100%, 50%)", channel: "hue" });
    expect(hue.getByRole("status")).toHaveTextContent("0°");
    expect(hue.getByRole("slider")).toHaveAttribute("aria-valuetext", "0°, red");
    cleanup();
    const saturation = renderSlider({ defaultValue: "hsl(0, 50%, 50%)", channel: "saturation" });
    expect(saturation.getByRole("status")).toHaveTextContent("50%");
    const alpha = renderSlider({ defaultValue: "hsla(0, 50%, 50%, 0.5)", channel: "alpha" });
    expect(alpha.getAllByRole("slider").at(-1)).toHaveAttribute("aria-valuetext", "50%");
  });

  it("jumps to a press on the track and drags", () => {
    const onChange = vi.fn();
    const onChangeEnd = vi.fn();
    const { getByRole } = renderSlider({ defaultValue: "rgb(0, 0, 0)", onChange, onChangeEnd }, undefined, { style: { width: "255px", height: "20px" } });
    const track = getByRole("group");
    const rect = track.getBoundingClientRect();
    pointer("pointerdown", track, { clientX: rect.x + 100, clientY: rect.y + 10 });
    expect((onChange.mock.calls.at(-1)![0] as Color).getChannelValue("red")).toBe(100);
    expect(document.activeElement).toBe(getByRole("slider"));
    pointer("pointermove", window, { clientX: rect.x + 150, clientY: rect.y + 10 });
    expect((onChange.mock.calls.at(-1)![0] as Color).getChannelValue("red")).toBe(150);
    pointer("pointerup", window, { clientX: rect.x + 150, clientY: rect.y + 10 });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect((onChangeEnd.mock.calls[0]![0] as Color).getChannelValue("red")).toBe(150);
  });

  it("renders the channel gradient on the track and positions the thumb", () => {
    const { getByRole } = renderSlider({ defaultValue: "rgb(51, 0, 0)" });
    const track = getByRole("group");
    expect(track.style.background).toContain("linear-gradient(to right, rgb(0, 0, 0), rgb(255, 0, 0))");
    const thumb = track.querySelector(".rv-ColorThumb") as HTMLElement;
    expect(thumb.style.left).toBe("20%");
    expect(thumb.style.backgroundColor).toBe("rgb(51, 0, 0)");
  });
});
