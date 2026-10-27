// Ported from react-aria-components test/ColorWheel.test.js and react-aria test/color/useColorWheel.test.tsx
// (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isFocusVisible()`); `jest.fn` → `vi.fn`;
// `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`; default classes `rv-ColorWheel` / `rv-ColorThumb`;
// "should support dragging state": `fireEvent.mouseDown/mouseUp` → `pointerdown` / `pointerup` (Chromium has
// PointerEvent, so upstream's mouse fallback path is not taken).
// useColorWheel: the test component spreads `useColorWheel`'s bags → binds the `./behaviour.tsx` parts (bindings for
// the changing values, inline arrows for the handlers); `jest.useFakeTimers` / `runAllTimers` → `vi.*` with
// `userEvent.setup({ delay: null })` (as upstream; user-event's default delay waits on the faked clock); pointer coordinates via clientX / clientY (page = client: no scroll; `PointerEvent` has no pageX init).
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files); the
// useColorWheel "Mouse Events" / "Touch Events" variants (Rivet's useMove port is pointer-only: mouse / touch
// fallbacks are only for environments without PointerEvent, which Rivet does not support).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import {
  ColorWheel,
  ColorWheelContext,
  ColorWheelTrack,
  colorWheelInputChange,
  colorWheelInputFocus,
  colorWheelInputLabels,
  colorWheelInputRange,
  colorWheelInputStyle,
  colorWheelInputValue,
  colorWheelInputValueText,
  colorWheelThumbKeyDown,
  colorWheelThumbPointerDown,
  colorWheelThumbStyle,
  colorWheelTrackPointerDown,
  colorWheelTrackStyle,
  createColorWheelInteraction,
  type ColorWheelAriaOptions,
  type ColorWheelProps,
} from "../color-wheel/index.tsx";
import { ColorThumb, type ColorThumbProps } from "../color-thumb/index.tsx";
import { createColorWheelState, parseColor, toColor, type Color, type ColorWheelProps as StatelyColorWheelProps } from "../color/index.ts";


const pointer = (type: string, target: EventTarget, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init }));

const TestColorWheel = (props: { wheelProps?: Partial<ColorWheelProps>; thumbProps?: ColorThumbProps }) => (
  <ColorWheel defaultValue="hsl(0, 100%, 50%)" outerRadius={100} innerRadius={80} {...props.wheelProps}>
    <ColorThumb {...props.thumbProps} />
  </ColorWheel>
);

const renderColorWheel = (wheelProps?: Partial<ColorWheelProps>, thumbProps?: ColorThumbProps) =>
  within(render(() => <TestColorWheel wheelProps={wheelProps} thumbProps={thumbProps} />).container as HTMLElement);

describe("ColorWheel", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a color wheel with default class", () => {
    const { getByRole } = renderColorWheel();
    const slider = getByRole("slider");
    expect(slider.parentElement!.parentElement).toHaveAttribute("class", "rv-ColorWheel");
    expect(slider).toHaveAttribute("aria-label", "Hue");
    expect(slider.parentElement!.parentElement!.querySelector(".rv-ColorThumb")).toBeInTheDocument();
  });

  // Rivet: the thumb lists the keys its keydown handles in `data-rk` (a cold PageUp must not step the native range input).
  it("lists the thumb keys in data-rk", () => {
    const { getByRole } = renderColorWheel();
    expect(getByRole("slider").closest(".rv-ColorThumb")).toHaveAttribute("data-rk", "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown");
  });

  it("should render a color wheel with custom class", () => {
    const { getByRole } = renderColorWheel({ class: "test" });
    expect(getByRole("slider").parentElement!.parentElement).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderColorWheel({ "data-foo": "bar" } as never);
    expect(getByRole("slider").parentElement!.parentElement).toHaveAttribute("data-foo", "bar");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support render props", () => {
    const { container } = render(() => (
      <ColorWheel isDisabled defaultValue="hsl(0, 100%, 50%)" outerRadius={100} innerRadius={80}>
        {({ isDisabled }) => (
          <div class={`${isDisabled() ? "disabled" : ""}`} data-testid="wrapper">
            <ColorThumb />
          </div>
        )}
      </ColorWheel>
    ));
    expect(within(container as HTMLElement).getByTestId("wrapper")).toHaveClass("disabled");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={ColorWheelContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestColorWheel wheelProps={{ slot: "test" }} />
      </Provider>
    ));
    const slider = within(container as HTMLElement).getByRole("slider");
    expect(slider.parentElement!.parentElement).toHaveAttribute("slot", "test");
    expect(slider).toHaveAttribute("aria-label", "test");
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderColorWheel({}, { class: ({ isFocusVisible }) => `thumb ${isFocusVisible() ? "focus" : ""}` });
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
    const { getByRole } = renderColorWheel({}, { class: ({ isDragging }) => `thumb ${isDragging() ? "dragging" : ""}` });
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
    const { getByRole } = renderColorWheel(
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
    const { getByRole } = renderColorWheel(
      { isDisabled: true, class: ({ isDisabled }) => (isDisabled() ? "disabled" : "") },
      { class: ({ isDisabled }) => `thumb ${isDisabled() ? "disabled" : ""}` },
    );
    const slider = getByRole("slider");
    const wrapper = slider.parentElement!.parentElement!;
    const thumb = slider.closest(".thumb")!;

    expect(slider).toBeDisabled();
    expect(thumb).toHaveAttribute("data-disabled", "true");
    expect(thumb).toHaveClass("disabled");

    expect(wrapper).toHaveAttribute("data-disabled", "true");
    expect(wrapper).toHaveClass("disabled");
  });

  it("should support repeat keydown events when holding Page Up/Page Down", async () => {
    // Page Up/Down change the hue by the page step (15); the arrow keys are handled by useMove instead.
    const { getByRole } = renderColorWheel();
    const slider = getByRole("slider");

    await user.tab();
    await user.keyboard("{PageUp>3/}");
    expect(slider).toHaveValue("45");

    await user.keyboard("{PageDown>3/}");
    expect(slider).toHaveValue("0");
  });

  it("should support form prop", () => {
    const { getByRole } = renderColorWheel({ form: "test" });
    expect(getByRole("slider")).toHaveAttribute("form", "test");
  });

  // Rivet additions
  it("renders the track with the conic hue gradient and ring clip path; updates a two-way Signal", async () => {
    const value = signal<string | Color>("hsl(10, 100%, 50%)");
    const { container } = render(() => (
      <ColorWheel value={value} outerRadius={100} innerRadius={80} name="hue">
        <ColorWheelTrack />
        <ColorThumb />
      </ColorWheel>
    ));
    const { getByRole } = within(container as HTMLElement);
    const track = (container as HTMLElement).querySelector(".rv-ColorWheelTrack") as HTMLElement;
    expect(track.style.background).toContain("conic-gradient");
    expect(track.style.clipPath).toContain("path(");
    const slider = getByRole("slider") as HTMLInputElement;
    expect(slider.name).toBe("hue");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(toColor(value())!.getChannelValue("hue")).toBe(11);
    expect(slider.value).toBe("11");
  });
});

// ---- useColorWheel ----

const SIZE = 24;
const CENTER = SIZE / 2;
const THUMB_RADIUS = 9;

const getBoundingClientRect = () => ({ width: SIZE, height: SIZE, x: 0, y: 0, top: 0, left: 0, bottom: SIZE, right: SIZE, toJSON() {} }) as DOMRect;

function HookWheel(props: StatelyColorWheelProps) {
  const state = createColorWheelState(props);
  const inputRef = createRef<HTMLInputElement>();
  const opts: ColorWheelAriaOptions = {
    ...props,
    innerRadius: THUMB_RADIUS - 3,
    outerRadius: THUMB_RADIUS + 3,
    inputRef,
    locale: "en-US",
    interaction: createColorWheelInteraction(),
  };
  const labels = colorWheelInputLabels(opts, state);
  const isDisabled = props.isDisabled;
  return (
    <div
      data-testid="container"
      style={colorWheelTrackStyle(opts)}
      onPointerDown={isDisabled ? undefined : (e: PointerEvent) => colorWheelTrackPointerDown(e, opts, state)}
    >
      <div
        data-testid="thumb"
        style={colorWheelThumbStyle(opts, state)}
        onPointerDown={isDisabled ? undefined : (e: PointerEvent) => colorWheelThumbPointerDown(e, opts, state)}
        onKeyDown={isDisabled ? undefined : (e: KeyboardEvent) => colorWheelThumbKeyDown(e, opts, state)}
      >
        <input
          ref={inputRef}
          {...labels}
          type="range"
          {...colorWheelInputRange(state)}
          aria-valuetext={colorWheelInputValueText(opts, state)}
          disabled={isDisabled || undefined}
          value={colorWheelInputValue(state)}
          style={colorWheelInputStyle}
          onChange={(e: Event) => colorWheelInputChange(e, opts, state)}
          onFocus={(e: FocusEvent) => colorWheelInputFocus(e, opts, state)}
        />
      </div>
    </div>
  );
}

describe("useColorWheel", () => {
  const onChangeSpy = vi.fn();
  let user: ReturnType<typeof userEvent.setup>;

  beforeAll(() => {
    user = userEvent.setup({ delay: null });
    vi.useFakeTimers();
  });

  afterEach(() => {
    onChangeSpy.mockClear();
    vi.runAllTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const renderWheel = (props: StatelyColorWheelProps = {}, around = false) => {
    const { container } = render(() =>
      around ? (
        <div>
          <button>A</button>
          <HookWheel {...props} />
          <button>B</button>
        </div>
      ) : (
        <HookWheel {...props} />
      ),
    );
    return within(container as HTMLElement);
  };

  it("sets input props", () => {
    const { getByRole } = renderWheel();
    const slider = getByRole("slider") as HTMLInputElement;
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "360");
    expect(slider).toHaveAttribute("step", "1");
    // React renders `value` as the attribute; Rivet binds the property.
    expect(slider.value).toBe("0");
  });

  it("the slider is focusable", async () => {
    const { getAllByRole, getByRole } = renderWheel({}, true);
    const slider = getByRole("slider");
    const [buttonA, buttonB] = getAllByRole("button");

    await user.tab();
    expect(document.activeElement).toBe(buttonA);
    await user.tab();
    expect(document.activeElement).toBe(slider);
    await user.tab();
    expect(document.activeElement).toBe(buttonB);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(slider);
  });

  it("disabled", async () => {
    const { getAllByRole, getByRole } = renderWheel({ isDisabled: true }, true);
    const slider = getByRole("slider");
    const [buttonA, buttonB] = getAllByRole("button");
    expect(slider).toHaveAttribute("disabled");

    await user.tab();
    expect(document.activeElement).toBe(buttonA);
    await user.tab();
    expect(document.activeElement).toBe(buttonB);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(buttonA);
  });

  describe("keyboard events", () => {
    const defaultColor = parseColor("hsl(0, 100%, 50%)");
    const hsla = (call: number) => (onChangeSpy.mock.calls[call]![0] as Color).toString("hsla");

    it("left/right works", async () => {
      const { getByRole } = renderWheel({ defaultValue: defaultColor, onChange: onChangeSpy });
      const slider = getByRole("slider") as HTMLInputElement;
      slider.focus();

      await user.keyboard("{ArrowRight}");
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(hsla(0)).toBe(defaultColor.withChannelValue("hue", 1).toString("hsla"));
      expect(slider.value).toBe("1");
      await user.keyboard("{ArrowLeft}");
      expect(onChangeSpy).toHaveBeenCalledTimes(2);
      expect(hsla(1)).toBe(defaultColor.withChannelValue("hue", 0).toString("hsla"));
      expect(slider.value).toBe("0");
    });

    it("up/down works", async () => {
      const { getByRole } = renderWheel({ defaultValue: defaultColor, onChange: onChangeSpy });
      const slider = getByRole("slider") as HTMLInputElement;
      slider.focus();

      await user.keyboard("{ArrowUp}");
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(hsla(0)).toBe(defaultColor.withChannelValue("hue", 1).toString("hsla"));
      expect(slider.value).toBe("1");
      await user.keyboard("{ArrowDown}");
      expect(onChangeSpy).toHaveBeenCalledTimes(2);
      expect(hsla(1)).toBe(defaultColor.withChannelValue("hue", 0).toString("hsla"));
      expect(slider.value).toBe("0");
    });

    it("doesn't work when disabled", async () => {
      const { getByRole } = renderWheel({ defaultValue: defaultColor, onChange: onChangeSpy, isDisabled: true });
      const slider = getByRole("slider") as HTMLInputElement;
      slider.focus();

      await user.keyboard("{ArrowRight}");
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      await user.keyboard("{ArrowLeft}");
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
    });

    it("wraps around", async () => {
      const { getByRole } = renderWheel({ defaultValue: defaultColor, onChange: onChangeSpy });
      const slider = getByRole("slider") as HTMLInputElement;
      slider.focus();

      await user.keyboard("{ArrowLeft}");
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(hsla(0)).toBe(defaultColor.withChannelValue("hue", 359).toString("hsla"));
      expect(slider.value).toBe("359");
    });

    it("steps with page up/down", async () => {
      const { getByRole } = renderWheel({ defaultValue: defaultColor, onChange: onChangeSpy });
      const slider = getByRole("slider") as HTMLInputElement;
      slider.focus();

      await user.keyboard("{PageUp}");
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(hsla(0)).toBe(defaultColor.withChannelValue("hue", 15).toString("hsla"));
      expect(slider.value).toBe("15");
      await user.keyboard("{PageDown}");
      expect(onChangeSpy).toHaveBeenCalledTimes(2);
      expect(hsla(1)).toBe(defaultColor.withChannelValue("hue", 0).toString("hsla"));
      expect(slider.value).toBe("0");
    });
  });

  describe("Pointer Events", () => {
    const start = (el: Element, at: { pageX: number; pageY: number }) => pointer("pointerdown", el, { clientX: at.pageX, clientY: at.pageY });
    const move = (el: Element, at: { pageX: number; pageY: number }) => pointer("pointermove", el, { clientX: at.pageX, clientY: at.pageY });
    const end = (el: Element, at: { pageX: number; pageY: number }) => pointer("pointerup", el, { clientX: at.pageX, clientY: at.pageY });
    const defaultColor = parseColor("hsl(0, 100%, 50%)");
    const hsla = (call: number) => (onChangeSpy.mock.calls[call]![0] as Color).toString("hsla");
    const setup = (isDisabled = false) => {
      const q = renderWheel({ defaultValue: defaultColor, onChange: onChangeSpy, isDisabled });
      const container = q.getByTestId("container");
      container.getBoundingClientRect = getBoundingClientRect;
      return { thumb: q.getByTestId("thumb"), slider: q.getByRole("slider") as HTMLInputElement, container };
    };

    it("dragging the thumb works", () => {
      const { thumb, slider } = setup();

      expect(document.activeElement).not.toBe(slider);
      start(thumb, { pageX: CENTER + THUMB_RADIUS, pageY: CENTER });
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      expect(document.activeElement).toBe(slider);

      move(thumb, { pageX: CENTER, pageY: CENTER + THUMB_RADIUS });
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(hsla(0)).toBe(defaultColor.withChannelValue("hue", 90).toString("hsla"));
      expect(document.activeElement).toBe(slider);
      expect(slider.value).toBe("90");

      end(thumb, { pageX: CENTER, pageY: CENTER + THUMB_RADIUS });
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(slider);
    });

    it("dragging the thumb doesn't work when disabled", () => {
      const { thumb, slider } = setup(true);

      expect(document.activeElement).not.toBe(slider);
      start(thumb, { pageX: CENTER + THUMB_RADIUS, pageY: CENTER });
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      expect(document.activeElement).not.toBe(slider);

      move(thumb, { pageX: CENTER, pageY: CENTER + THUMB_RADIUS });
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      expect(document.activeElement).not.toBe(slider);

      end(thumb, { pageX: CENTER, pageY: CENTER + THUMB_RADIUS });
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      expect(document.activeElement).not.toBe(slider);
    });

    it("clicking and dragging on the track works", () => {
      const { thumb, slider, container } = setup();

      expect(document.activeElement).not.toBe(slider);
      start(container, { pageX: CENTER, pageY: CENTER + THUMB_RADIUS });
      expect(onChangeSpy).toHaveBeenCalledTimes(1);
      expect(hsla(0)).toBe(defaultColor.withChannelValue("hue", 90).toString("hsla"));
      expect(slider.value).toBe("90");
      expect(document.activeElement).toBe(slider);

      move(thumb, { pageX: CENTER - THUMB_RADIUS, pageY: CENTER });
      expect(onChangeSpy).toHaveBeenCalledTimes(2);
      expect(hsla(1)).toBe(defaultColor.withChannelValue("hue", 180).toString("hsla"));
      expect(slider.value).toBe("180");
      expect(document.activeElement).toBe(slider);

      end(thumb, { pageX: CENTER - THUMB_RADIUS, pageY: CENTER });
      expect(onChangeSpy).toHaveBeenCalledTimes(2);
      expect(document.activeElement).toBe(slider);
    });

    it("clicking and dragging on the track doesn't work when disabled", () => {
      const { slider, container } = setup(true);

      expect(document.activeElement).not.toBe(slider);
      start(container, { pageX: CENTER, pageY: CENTER + THUMB_RADIUS });
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      expect(document.activeElement).not.toBe(slider);

      move(container, { pageX: CENTER - THUMB_RADIUS, pageY: CENTER });
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      expect(document.activeElement).not.toBe(slider);

      end(container, { pageX: CENTER - THUMB_RADIUS, pageY: CENTER });
      expect(onChangeSpy).toHaveBeenCalledTimes(0);
      expect(document.activeElement).not.toBe(slider);
    });
  });

  it.skip("Mouse Events / Touch Events variants (pointer-only useMove port)", () => {});
});
