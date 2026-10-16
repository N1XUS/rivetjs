// Ported from react-aria-components test/Slider.test.js and react-aria test/slider/useSlider.test.js,
// test/slider/useSliderThumb.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within(container)` /
// `screen`; `className` → `class` (render props are accessors: `isDragging()`, `orientation()`); `jest.fn` → `vi.fn`;
// `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`; default classes `rv-Slider*`; `rerender` →
// a signal prop; `React.createRef()` → `ref()`; `fireEvent.pointer*` → real `PointerEvent`s (pointerId 1, `pageX` =
// `clientX`); hooks (`renderHook(useSlider / useSliderThumb)`) → `sliderProps` / `sliderThumbProps` bags (accessor
// values read with `read()`), hook examples → components binding the `slider*` handlers.
// Skipped: "should support custom render function" (now in the render-*.browser.test.tsx files); the "using
// MouseEvents" drag cases (`installMouseEvent`: jsdom without PointerEvent — RA useMove's mouse fallback; Chromium
// always has PointerEvent and Rivet's useMove is pointer-only). The mouse *click* on the track still runs.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal, untrack } from "@rivetjs/reactivity";
import { Provider, ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { screen, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Label } from "../label/index.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { moveProps } from "../interactions/move.tsx";
import { read } from "../interactions/utils.ts";
import {
  Slider,
  SliderContext,
  SliderFill,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  createSliderState,
  sliderProps,
  sliderThumbKeyDown,
  sliderThumbMouseDown,
  sliderThumbMove,
  sliderThumbMoveEnd,
  sliderThumbMoveStart,
  sliderThumbPointerDown,
  sliderThumbProps,
  sliderTrackMouseDown,
  sliderTrackMove,
  sliderTrackMoveEnd,
  sliderTrackMoveStart,
  sliderTrackPointerDown,
  sliderValues,
  type AriaSliderProps,
  type SliderFillProps,
  type SliderOutputProps,
  type SliderProps,
  type SliderState,
  type SliderThumbProps,
  type SliderTrackProps,
} from "../slider/index.tsx";

afterEach(cleanup);

interface TestProps {
  sliderProps?: Partial<SliderProps<any>>;
  thumbProps?: Partial<SliderThumbProps>;
  trackProps?: Partial<SliderTrackProps>;
  outputProps?: Partial<SliderOutputProps>;
  fillProps?: Partial<SliderFillProps>;
}

function TestSlider(props: TestProps) {
  return (
    <Slider {...props.sliderProps}>
      <Label>Opacity</Label>
      <SliderOutput {...props.outputProps} />
      <SliderTrack {...props.trackProps}>
        <SliderFill {...props.fillProps} />
        <SliderThumb {...props.thumbProps} />
      </SliderTrack>
    </Slider>
  );
}

const renderSlider = (
  sliderProps?: Partial<SliderProps>,
  thumbProps?: Partial<SliderThumbProps>,
  trackProps?: Partial<SliderTrackProps>,
  outputProps?: Partial<SliderOutputProps>,
) => {
  const { container } = render(() => <TestSlider sliderProps={sliderProps} thumbProps={thumbProps} trackProps={trackProps} outputProps={outputProps} />);
  return within(container as HTMLElement);
};

const pointer = (type: string, target: EventTarget, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init }));
/** Inline style values (jest-dom `toHaveStyle` reads computed px in a real browser). */
const inline = (el: HTMLElement) => ({
  position: el.style.position,
  insetInlineStart: el.style.insetInlineStart,
  bottom: el.style.bottom,
  width: el.style.width,
  height: el.style.height,
});
const mouse = (type: string, target: EventTarget, init: MouseEventInit = {}) =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init }));

describe("Slider", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a slider with default class", () => {
    const { getByRole } = renderSlider();
    const group = getByRole("group");
    expect(group).toHaveAttribute("class", "rv-Slider");
    expect(group).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)).toHaveTextContent("Opacity");
    expect(getByRole("status")).toHaveTextContent("0");
    expect(group.querySelector(".rv-SliderTrack")).toBeInTheDocument();
    expect(group.querySelector(".rv-SliderThumb")).toBeInTheDocument();
    expect(group.querySelector(".rv-SliderFill")).toBeInTheDocument();
  });

  // Rivet: RAC SliderThumb useSlot — without a thumb <Label> the input is labelled by the slider label only
  // (no aria-labelledby id without an element: dev a11y warning otherwise).
  it("labels thumb inputs only by labels that render", async () => {
    const { getAllByRole } = within(
      render(() => (
        <div>
          <Slider defaultValue={30}>
            <Label>Volume</Label>
            <SliderTrack>
              <SliderThumb />
            </SliderTrack>
          </Slider>
          <Slider defaultValue={[20, 80]}>
            <Label>Range</Label>
            <SliderTrack>
              <SliderThumb index={0}>
                <Label>Min</Label>
              </SliderThumb>
              <SliderThumb index={1} />
            </SliderTrack>
          </Slider>
        </div>
      )).container as HTMLElement,
    );
    await flush();
    const names = getAllByRole("slider").map((input) =>
      input
        .getAttribute("aria-labelledby")!
        .split(" ")
        .map((id) => document.getElementById(id)?.textContent ?? `missing #${id}`),
    );
    expect(names).toEqual([["Volume"], ["Min", "Range"], ["Range"]]);
  });

  it("should render a slider with custom class", () => {
    const { getByRole } = renderSlider({ class: "test" });
    const group = getByRole("group");
    expect(group).toHaveAttribute("class", "test");
  });

  it("should support DOM props", () => {
    const { getByRole } = renderSlider(
      { "data-foo": "bar" } as Partial<SliderProps>,
      { "data-bar": "foo" } as Partial<SliderThumbProps>,
      { "data-test": "test" } as Partial<SliderTrackProps>,
      { "data-output": "output" } as Partial<SliderOutputProps>,
    );
    const group = getByRole("group");
    expect(group).toHaveAttribute("data-foo", "bar");
    expect(group.querySelector(".rv-SliderThumb")).toHaveAttribute("data-bar", "foo");
    expect(group.querySelector(".rv-SliderTrack")).toHaveAttribute("data-test", "test");
    expect(group.querySelector(".rv-SliderOutput")).toHaveAttribute("data-output", "output");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support render props", () => {
    render(() => (
      <Slider orientation="vertical">
        {({ orientation }) => (
          <div class={`slider-${orientation()}`} data-testid="wrapper">
            <Label>Opacity</Label>
            <SliderOutput />
            <SliderTrack>
              <SliderThumb />
            </SliderTrack>
          </div>
        )}
      </Slider>
    ));
    expect(screen.getByTestId("wrapper")).toHaveClass("slider-vertical");
  });

  it("should support slot", () => {
    const { container } = render(() => (
      <Provider token={SliderContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestSlider sliderProps={{ slot: "test" }} />
      </Provider>
    ));
    const group = within(container as HTMLElement).getByRole("group");
    expect(group).toHaveAttribute("slot", "test");
    expect(group).toHaveAttribute("aria-label", "test");
  });

  it("should support focus ring", async () => {
    const { getByRole } = renderSlider({}, { class: ({ isFocusVisible }) => `thumb ${isFocusVisible() ? "focus" : ""}` });
    const slider = getByRole("slider");
    const thumb = slider.closest(".thumb");

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

    mouse("mousedown", thumb);
    expect(thumb).toHaveAttribute("data-dragging", "true");
    expect(thumb).toHaveClass("dragging");

    mouse("mouseup", thumb);
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
    const group = getByRole("group");
    const slider = getByRole("slider");
    const thumb = slider.closest(".thumb");

    expect(slider).toBeDisabled();
    expect(thumb).toHaveAttribute("data-disabled", "true");
    expect(thumb).toHaveClass("disabled");

    expect(group).toHaveAttribute("data-disabled", "true");
    expect(group).toHaveClass("disabled");
  });

  it("should support orientation", () => {
    const { getByRole } = renderSlider({ orientation: "vertical", class: ({ orientation }) => orientation() });
    const group = getByRole("group");
    const slider = getByRole("slider");

    expect(group).toHaveAttribute("data-orientation", "vertical");
    expect(group).toHaveClass("vertical");
    expect(slider).toHaveAttribute("aria-orientation", "vertical");
  });

  it("should support two thumbs", () => {
    const { container } = render(() => (
      <Slider defaultValue={[30, 60]}>
        <Label>Test</Label>
        <SliderOutput />
        <SliderTrack>{({ state }) => untrack(() => sliderValues(state)).map((_, i) => <SliderThumb index={i} />)}</SliderTrack>
      </Slider>
    ));
    const { getByRole, getAllByRole } = within(container as HTMLElement);

    const sliders = getAllByRole("slider");
    expect(sliders).toHaveLength(2);
    expect(sliders[0]).toHaveValue("30");
    expect(sliders[1]).toHaveValue("60");

    const output = getByRole("status");
    expect(output).toHaveTextContent("30–60");
  });

  it("should support three thumbs", () => {
    const { container } = render(() => (
      <Slider defaultValue={[30, 60, 80]}>
        <Label>Test</Label>
        <SliderOutput />
        <SliderTrack>{({ state }) => untrack(() => sliderValues(state)).map((_, i) => <SliderThumb index={i} />)}</SliderTrack>
      </Slider>
    ));
    const { getByRole, getAllByRole } = within(container as HTMLElement);

    const sliders = getAllByRole("slider");
    expect(sliders).toHaveLength(3);
    expect(sliders[0]).toHaveValue("30");
    expect(sliders[1]).toHaveValue("60");
    expect(sliders[2]).toHaveValue("80");

    const output = getByRole("status");
    expect(output).toHaveTextContent("30, 60, 80");
  });

  it("should support multiple thumbs (controlled)", async () => {
    const value = signal([30, 60]);
    const { container } = render(() => (
      <div>
        <Slider value={value}>
          <Label>Test</Label>
          <SliderOutput />
          <SliderTrack>{({ state }) => untrack(() => sliderValues(state)).map((_, i) => <SliderThumb index={i} class="thumb" />)}</SliderTrack>
        </Slider>
        <button data-testid="reset-button" onClick={() => value.set([0, 100])}>
          reset
        </button>
      </div>
    ));
    const { getAllByRole, getByTestId } = within(container as HTMLElement);

    const sliders = getAllByRole("slider");

    expect(sliders).toHaveLength(2);
    expect(sliders[0]).toHaveValue("30");
    expect(sliders[1]).toHaveValue("60");

    const resetButton = getByTestId("reset-button");
    await user.click(resetButton);
    expect(sliders[0]).toHaveValue("0");
    expect(sliders[1]).toHaveValue("100");

    await user.tab(); // body (because we've clicked the reset button?)
    await user.tab();
    expect(document.activeElement).toBe(sliders[0]);

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    expect(sliders[0]).toHaveValue("3");
    expect(sliders[1]).toHaveValue("100");

    await user.click(resetButton);
    expect(sliders[0]).toHaveValue("0");
    expect(sliders[1]).toHaveValue("100");

    await user.tab(); // body
    await user.tab(); // sliders[0]
    await user.tab();
    expect(document.activeElement).toBe(sliders[1]);

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{ArrowLeft}");
    expect(sliders[0]).toHaveValue("0");
    expect(sliders[1]).toHaveValue("97");
  });

  it("should support repeat keydown events when holding Page Up/Page Down", async () => {
    // Default pageSize for a 0-100 slider is 10.
    const { getByRole } = renderSlider({ defaultValue: 20 });

    const slider = getByRole("slider");
    await user.tab();
    expect(document.activeElement).toBe(slider);

    await user.keyboard("{PageUp>3/}");
    expect(slider).toHaveValue("50");

    await user.keyboard("{PageDown>3/}");
    expect(slider).toHaveValue("20");
  });

  it("should support clicking on the track to move the thumb", async () => {
    const onChange = vi.fn();
    const { getByRole } = renderSlider({ onChange });
    const group = getByRole("group");
    const track = group.querySelector(".rv-SliderTrack")!;

    await user.pointer([{ target: track, keys: "[MouseLeft]", coords: { x: 20 } }]);
    expect(onChange).toHaveBeenCalled();
  });

  it("should support input ref", async () => {
    const inputRef = ref<HTMLInputElement>();

    const { container } = render(() => (
      <Slider>
        <Label>Test</Label>
        <SliderOutput />
        <SliderTrack>
          <SliderThumb inputRef={inputRef} />
        </SliderTrack>
      </Slider>
    ));

    await flush();
    const group = within(container as HTMLElement).getByRole("group");
    const thumbInput = group.querySelector("input");
    expect(inputRef()).toBe(thumbInput);
  });

  it("should support form prop", () => {
    const { getByRole } = renderSlider({}, { form: "test" });
    const input = getByRole("slider");
    expect(input).toHaveAttribute("form", "test");
  });

  it("should support horizontal SliderFill", () => {
    const { container } = render(() => <TestSlider sliderProps={{ value: 30 }} />);
    const fill = (container as HTMLElement).querySelector(".rv-SliderFill") as HTMLElement;
    expect(fill).toHaveAttribute("data-orientation", "horizontal");
    expect(inline(fill)).toMatchObject({ position: "absolute", insetInlineStart: "0%", width: "30%", height: "100%" });
  });

  it("should support horizontal SliderFill with offset", () => {
    const value = signal(30);
    const { container } = render(() => <TestSlider sliderProps={{ value }} fillProps={{ offset: 50 }} />);
    const fill = (container as HTMLElement).querySelector(".rv-SliderFill") as HTMLElement;
    expect(fill).toHaveAttribute("data-orientation", "horizontal");
    expect(inline(fill)).toMatchObject({ position: "absolute", insetInlineStart: "30%", width: "20%", height: "100%" });

    value.set(80);
    expect(inline(fill)).toMatchObject({ position: "absolute", insetInlineStart: "50%", width: "30%", height: "100%" });
  });

  it("should support vertical SliderFill", () => {
    const { container } = render(() => <TestSlider sliderProps={{ value: 30, orientation: "vertical" }} />);
    const fill = (container as HTMLElement).querySelector(".rv-SliderFill") as HTMLElement;
    expect(fill).toHaveAttribute("data-orientation", "vertical");
    expect(inline(fill)).toMatchObject({ position: "absolute", bottom: "0%", height: "30%", width: "100%" });
  });

  it("should support vertical SliderFill with offset", () => {
    const value = signal(30);
    const { container } = render(() => <TestSlider sliderProps={{ value, orientation: "vertical" }} fillProps={{ offset: 50 }} />);
    const fill = (container as HTMLElement).querySelector(".rv-SliderFill") as HTMLElement;
    expect(fill).toHaveAttribute("data-orientation", "vertical");
    expect(inline(fill)).toMatchObject({ position: "absolute", bottom: "30%", height: "20%", width: "100%" });

    value.set(80);
    expect(inline(fill)).toMatchObject({ position: "absolute", bottom: "50%", height: "30%", width: "100%" });
  });
});

// ---- react-aria useSlider.test.js ----

function stubRect(rect: Partial<DOMRect>) {
  let spy: ReturnType<typeof vi.spyOn> | undefined;
  beforeAll(() => {
    spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => rect as DOMRect);
  });
  afterAll(() => {
    spy?.mockRestore();
  });
}

/** RA test `Example`: a track div with useSlider's track props. */
function TrackExample(props: AriaSliderProps<number[]> & { stateRef: { current?: SliderState } }) {
  const state = createSliderState(props);
  props.stateRef.current = state;
  const trackRef = ref<HTMLDivElement>();
  const { style, ...trackProps } = sliderProps(props, state).trackProps;
  const { moveProps: move } = moveProps({
    onMoveStart: (e) => sliderTrackMoveStart(e, state),
    onMove: (e) => sliderTrackMove(e, props, state, trackRef() ?? null),
    onMoveEnd: (e) => sliderTrackMoveEnd(e, state),
  });
  const attrs = mergeProps(
    {
      ...trackProps,
      onMouseDown: (e: MouseEvent) => sliderTrackMouseDown(e, props, state, e.currentTarget as Element),
      onPointerDown: (e: PointerEvent) => sliderTrackPointerDown(e, props, state, e.currentTarget as Element),
    },
    move,
  );
  return <div data-testid="track" ref={trackRef} {...attrs} style={style as Record<string, string>} />;
}

describe("useSlider", () => {
  describe("aria labels", () => {
    function renderUseSlider(props: AriaSliderProps<number[]>) {
      const state = createSliderState(props);
      const result = sliderProps(props, state);
      const { inputProps } = sliderThumbProps({ index: 0, trackRef: () => null }, state);
      return { state, props: result, inputProps };
    }

    it("should have the right labels when setting label", () => {
      const result = renderUseSlider({ defaultValue: [0], label: "Slider" });
      const { labelProps, groupProps } = result.props;
      expect(groupProps.role).toBe("group");
      expect(labelProps.for).toBe(undefined); // https://bugs.webkit.org/show_bug.cgi?id=172464
    });

    it("should have the right labels when setting aria-label", () => {
      const result = renderUseSlider({ defaultValue: [0], "aria-label": "Slider" });
      const { labelProps, groupProps } = result.props;
      expect(labelProps).toEqual({});
      expect(groupProps.role).toBe("group");
      expect(groupProps["aria-label"]).toBe("Slider");
    });

    // Rivet: a cold keydown on a resumed page is held only for the keys in `data-rk`; without them the
    // native range input moved by its own page size before the handler loaded (docs slider-range).
    it("lists the keys the thumb handles in data-rk (none when disabled)", () => {
      expect(renderUseSlider({ defaultValue: [0], "aria-label": "Slider" }).inputProps["data-rk"]).toBe(
        "ArrowLeft ArrowRight ArrowUp ArrowDown PageUp PageDown Home End",
      );
      expect(renderUseSlider({ defaultValue: [0], "aria-label": "Slider", isDisabled: true }).inputProps["data-rk"]).toBe(undefined);
    });
  });

  describe("interactions on track", () => {
    stubRect({ top: 0, left: 0, width: 100, height: 100 });
    const stateRef: { current?: SliderState } = {};

    it("should allow you to set value of closest thumb by clicking on track", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10, 80]} />);

      let track = screen.getByTestId("track");
      mouse("mousedown", track, { clientX: 20 });
      mouse("mouseup", track, { clientX: 20 });

      expect(onChangeSpy).toHaveBeenLastCalledWith([20, 80]);
      expect(onChangeEndSpy).toHaveBeenLastCalledWith([20, 80]);
      expect(untrack(() => sliderValues(stateRef.current!))).toEqual([20, 80]);

      track = screen.getByTestId("track");
      mouse("mousedown", track, { clientX: 90 });
      mouse("mouseup", track, { clientX: 90 });

      expect(onChangeSpy).toHaveBeenLastCalledWith([20, 90]);
      expect(onChangeEndSpy).toHaveBeenLastCalledWith([20, 90]);
      expect(untrack(() => sliderValues(stateRef.current!))).toEqual([20, 90]);
    });

    it.skip("should allow you to set value of closest thumb by dragging on track (mouse events: useMove mouse fallback)", () => {});

    it("should not allow you to set value if disabled", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => (
        <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10, 80]} isDisabled />
      ));

      const track = screen.getByTestId("track");
      mouse("mousedown", track, { clientX: 20 });
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(untrack(() => sliderValues(stateRef.current!))).toEqual([10, 80]);

      mouse("mousemove", track, { clientX: 30 });
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(untrack(() => sliderValues(stateRef.current!))).toEqual([10, 80]);

      mouse("mouseup", track, { clientX: 40 });
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(untrack(() => sliderValues(stateRef.current!))).toEqual([10, 80]);
    });

    it.skip("should allow you to set value of closest thumb by dragging on track (vertical) (mouse events: useMove mouse fallback)", () => {});
  });

  describe("interactions on track using pointerEvents", () => {
    stubRect({ top: 0, left: 0, width: 100, height: 100 });
    const stateRef: { current?: SliderState } = {};
    const values = () => untrack(() => sliderValues(stateRef.current!));

    it("should allow you to set value of closest thumb by clicking on track", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10, 80]} />);

      let track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 20 });
      pointer("pointerup", track, { clientX: 20 });

      expect(onChangeSpy).toHaveBeenLastCalledWith([20, 80]);
      expect(onChangeEndSpy).toHaveBeenLastCalledWith([20, 80]);
      expect(values()).toEqual([20, 80]);

      track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 90 });
      pointer("pointerup", track, { clientX: 90 });

      expect(onChangeSpy).toHaveBeenLastCalledWith([20, 90]);
      expect(onChangeEndSpy).toHaveBeenLastCalledWith([20, 90]);
      expect(values()).toEqual([20, 90]);
    });

    it("should allow you to set value of closest thumb by dragging on track", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10, 80]} />);

      const track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 20 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([20, 80]);
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([20, 80]);

      pointer("pointermove", track, { clientX: 30 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([30, 80]);
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([30, 80]);

      pointer("pointermove", track, { clientX: 40 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([40, 80]);
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([40, 80]);

      pointer("pointerup", track, { clientX: 40 });
      expect(onChangeEndSpy).toHaveBeenLastCalledWith([40, 80]);
      expect(values()).toEqual([40, 80]);
    });

    it("should allow you to set value of before thumbs when thumbs stacked", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[40, 40]} />);

      const track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 20 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([20, 40]);
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([20, 40]);
      pointer("pointerup", track, { clientX: 20 });
    });

    it("should allow you to set value of after thumbs when thumbs stacked", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[40, 40]} />);

      const track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 60 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([40, 60]);
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([40, 60]);
      pointer("pointerup", track, { clientX: 60 });
    });

    it("should allow you to set value of before thumbs when many thumbs and stacked", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => (
        <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[25, 25, 50, 75, 75]} />
      ));

      const track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 70 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([25, 25, 50, 70, 75]);
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      pointer("pointerup", track, { clientX: 70 });
      expect(onChangeEndSpy).toHaveBeenCalledWith([25, 25, 50, 70, 75]);
      expect(values()).toEqual([25, 25, 50, 70, 75]);

      pointer("pointerdown", track, { clientX: 20 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([20, 25, 50, 70, 75]);
      pointer("pointerup", track, { clientX: 70 });
      expect(onChangeEndSpy).toHaveBeenLastCalledWith([20, 25, 50, 70, 75]);
      expect(values()).toEqual([20, 25, 50, 70, 75]);
    });

    it("should allow you to set value of after thumbs when many thumbs and stacked", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => (
        <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[25, 25, 50, 75, 75]} />
      ));

      const track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 80 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([25, 25, 50, 75, 80]);
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      pointer("pointerup", track, { clientX: 80 });
      expect(onChangeEndSpy).toHaveBeenCalledWith([25, 25, 50, 75, 80]);
      expect(values()).toEqual([25, 25, 50, 75, 80]);

      pointer("pointerdown", track, { clientX: 30 });
      expect(onChangeSpy).toHaveBeenLastCalledWith([25, 30, 50, 75, 80]);
      pointer("pointerup", track, { clientX: 80 });
      expect(onChangeEndSpy).toHaveBeenLastCalledWith([25, 30, 50, 75, 80]);
      expect(values()).toEqual([25, 30, 50, 75, 80]);
    });

    it("should not allow you to set value if disabled", () => {
      const onChangeSpy = vi.fn();
      const onChangeEndSpy = vi.fn();
      render(() => (
        <TrackExample stateRef={stateRef} onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10, 80]} isDisabled />
      ));

      const track = screen.getByTestId("track");
      pointer("pointerdown", track, { clientX: 20 });
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([10, 80]);

      pointer("pointermove", track, { clientX: 30 });
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([10, 80]);

      pointer("pointerup", track, { clientX: 40 });
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect(onChangeEndSpy).not.toHaveBeenCalled();
      expect(values()).toEqual([10, 80]);
    });
  });
});

// ---- react-aria useSliderThumb.test.js ----

/** A thumb div + range input bound to useSliderThumb's bags and handlers (RA test markup). */
function ThumbExample(props: { state: SliderState; index: number; trackRef: () => Element | null | undefined; testId: string; "aria-label": string }) {
  const { state, index, trackRef } = props;
  const opts = { index, "aria-label": props["aria-label"], trackRef };
  const { thumbProps, inputProps } = sliderThumbProps(opts, state);
  const { moveProps: move } = moveProps({
    onMoveStart: (e) => sliderThumbMoveStart(e, opts, state),
    onMove: (e) => sliderThumbMove(e, opts, state),
    onMoveEnd: (e) => sliderThumbMoveEnd(e, opts, state),
  });
  const handlers = mergeProps({ onKeyDown: (e: KeyboardEvent) => sliderThumbKeyDown(e, opts, state) }, move, {
    onMouseDown: (e: MouseEvent) => sliderThumbMouseDown(e, opts, state),
    onPointerDown: (e: PointerEvent) => sliderThumbPointerDown(e, opts, state),
  });
  const { min, max, value, style: _s, ...staticInput } = inputProps as Record<string, any>;
  const style = thumbProps.style as () => Record<string, string>;
  return (
    <div data-testid={props.testId} {...handlers} style={style()}>
      <input {...staticInput} min={min()} max={max()} value={value()} />
    </div>
  );
}

describe("useSliderThumb", () => {
  describe("aria labels", () => {
    it("should have the right labels with Slider-level label", () => {
      const props = { label: "slider", defaultValue: [50], minValue: 10, maxValue: 200, step: 2 };
      const state = createSliderState(props);
      const { labelProps } = sliderProps(props, state);
      const { inputProps } = sliderThumbProps({ index: 0, trackRef: () => null }, state);
      const labelId = labelProps.id;
      expect(inputProps.type).toBe("range");
      expect(inputProps.step).toBe(2);
      expect(read(inputProps.value as () => number)).toBe(50);
      expect(read(inputProps.min as () => number)).toBe(10);
      expect(read(inputProps.max as () => number)).toBe(200);
      expect(inputProps["aria-labelledby"]).toBe(`${labelId}`);
    });

    it("should have the right labels with Slider thumb label", () => {
      const props = { "aria-label": "slider", defaultValue: [50], minValue: 10, maxValue: 200, step: 2 };
      const state = createSliderState(props);
      const { groupProps } = sliderProps(props, state);
      const { inputProps, labelProps } = sliderThumbProps({ index: 0, label: "thumb", trackRef: () => null }, state);
      const labelId = groupProps.id;
      expect(inputProps.type).toBe("range");
      expect(inputProps.step).toBe(2);
      expect(read(inputProps.value as () => number)).toBe(50);
      expect(read(inputProps.min as () => number)).toBe(10);
      expect(read(inputProps.max as () => number)).toBe(200);
      expect(inputProps["aria-labelledby"]).toBe(`${labelProps.id} ${labelId}`);
      expect(inputProps.id).toBe(labelProps.for);
    });

    it("should have the right labels with Slider thumb aria-label", () => {
      const props = { "aria-label": "slider", defaultValue: [50, 70], minValue: 10, maxValue: 200, step: 2 };
      const state = createSliderState(props);
      const { groupProps } = sliderProps(props, state);
      const { inputProps: inputProps0 } = sliderThumbProps({ index: 0, "aria-label": "thumb0", trackRef: () => null }, state);
      const { inputProps: inputProps1 } = sliderThumbProps({ index: 1, "aria-label": "thumb1", trackRef: () => null }, state);
      const labelId = groupProps.id;
      expect(inputProps0.type).toBe("range");
      expect(inputProps0.step).toBe(2);
      expect(read(inputProps0.value as () => number)).toBe(50);
      expect(read(inputProps0.min as () => number)).toBe(10);
      expect(read(inputProps0.max as () => number)).toBe(70);
      expect(inputProps0["aria-label"]).toBe("thumb0");
      expect(inputProps0["aria-labelledby"]).toBe(`${inputProps0.id} ${labelId}`);
      expect(inputProps1.type).toBe("range");
      expect(inputProps1.step).toBe(2);
      expect(read(inputProps1.value as () => number)).toBe(70);
      expect(read(inputProps1.min as () => number)).toBe(50);
      expect(read(inputProps1.max as () => number)).toBe(200);
      expect(inputProps1["aria-label"]).toBe("thumb1");
      expect(inputProps1["aria-labelledby"]).toBe(`${inputProps1.id} ${labelId}`);
    });
  });

  describe("interactions on thumbs, where track does not contain thumbs", () => {
    stubRect({ top: 0, left: 0, width: 100 });
    const stateRef: { current?: SliderState } = {};
    const values = () => untrack(() => sliderValues(stateRef.current!));

    function RangeExample(props: AriaSliderProps<number[]>) {
      const state = createSliderState(props);
      stateRef.current = state;
      const trackRef = ref<HTMLDivElement>();
      const { style } = sliderProps(props, state).trackProps;
      return (
        <div>
          <div data-testid="track" ref={trackRef} style={style as Record<string, string>} />
          <ThumbExample state={state} index={0} trackRef={trackRef} testId="thumb0" aria-label="Min" />
          <ThumbExample state={state} index={1} trackRef={trackRef} testId="thumb1" aria-label="Max" />
        </div>
      );
    }

    describe("using PointerEvents", () => {
      it("can be moved by dragging", () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <RangeExample onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10, 80]} />);

        // Drag thumb0
        const thumb0 = screen.getByTestId("thumb0");
        pointer("pointerdown", thumb0, { clientX: 10 });
        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([10, 80]);

        pointer("pointermove", thumb0, { clientX: 20 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([20, 80]);
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([20, 80]);

        pointer("pointermove", thumb0, { clientX: 30 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([30, 80]);
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([30, 80]);

        pointer("pointermove", thumb0, { clientX: 40 });
        pointer("pointerup", thumb0, { clientX: 40 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([40, 80]);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([40, 80]);
        expect(values()).toEqual([40, 80]);

        onChangeSpy.mockClear();
        onChangeEndSpy.mockClear();

        // Drag thumb1 past thumb0
        const thumb1 = screen.getByTestId("thumb1");
        pointer("pointerdown", thumb1, { clientX: 80 });
        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([40, 80]);

        pointer("pointermove", thumb1, { clientX: 60 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([40, 60]);
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([40, 60]);

        pointer("pointermove", thumb1, { clientX: 30 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([40, 40]);
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([40, 40]);

        pointer("pointerup", thumb1, { clientX: 30 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([40, 40]);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([40, 40]);
        expect(values()).toEqual([40, 40]);
      });
    });

    describe("using MouseEvents", () => {
      it.skip("can be moved by dragging (useMove mouse fallback: jsdom without PointerEvent)", () => {});
    });
  });

  describe("interactions on thumbs, where track contains thumbs", () => {
    stubRect({ top: 0, left: 0, width: 100, height: 100 });
    const stateRef: { current?: SliderState } = {};
    const values = () => untrack(() => sliderValues(stateRef.current!));

    function Example(props: AriaSliderProps<number[]>) {
      const state = createSliderState(props);
      stateRef.current = state;
      const trackRef = ref<HTMLDivElement>();
      const { style } = sliderProps(props, state).trackProps;
      return (
        <div data-testid="track" ref={trackRef} style={style as Record<string, string>}>
          <ThumbExample state={state} index={0} trackRef={trackRef} testId="thumb" aria-label="Min" />
        </div>
      );
    }

    describe("using PointerEvents", () => {
      it("can be moved by dragging", () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <Example onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10]} />);

        // Drag thumb
        const thumb0 = screen.getByTestId("thumb");
        pointer("pointerdown", thumb0, { clientX: 10 });
        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([10]);

        pointer("pointermove", thumb0, { clientX: 20 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([20]);
        expect(onChangeEndSpy).not.toHaveBeenCalled();
        expect(values()).toEqual([20]);

        pointer("pointermove", thumb0, { clientX: 40 });
        pointer("pointerup", thumb0, { clientX: 40 });
        expect(onChangeSpy).toHaveBeenLastCalledWith([40]);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([40]);
        expect(values()).toEqual([40]);
        expect(onChangeEndSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe("using MouseEvents", () => {
      it.skip("can be moved by dragging (useMove mouse fallback: jsdom without PointerEvent)", () => {});
      it.skip("can be moved by dragging (vertical) (useMove mouse fallback: jsdom without PointerEvent)", () => {});
    });

    describe("using KeyEvents", () => {
      let user: ReturnType<typeof userEvent.setup>;
      beforeAll(() => {
        user = userEvent.setup();
      });

      it("can be moved with keys", async () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <Example onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10]} />);

        await user.tab();
        await user.keyboard("{ArrowRight}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([11]);
        expect(onChangeSpy).toHaveBeenCalledTimes(1);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([11]);
        expect(onChangeEndSpy).toHaveBeenCalledTimes(1);
        expect(values()).toEqual([11]);

        await user.keyboard("{ArrowLeft}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([10]);
        expect(onChangeSpy).toHaveBeenCalledTimes(2);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([10]);
        expect(onChangeEndSpy).toHaveBeenCalledTimes(2);
        expect(values()).toEqual([10]);
      });

      it("can be moved with keys at the beginning of the slider", async () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <Example onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[0]} />);

        await user.tab();
        await user.keyboard("{ArrowLeft}");
        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onChangeEndSpy).toHaveBeenCalledWith([0]);

        await user.keyboard("{ArrowRight}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([1]);
        expect(onChangeSpy).toHaveBeenCalledTimes(1);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([1]);
        expect(onChangeEndSpy).toHaveBeenCalledTimes(2);
        expect(values()).toEqual([1]);
      });

      it("can be moved with keys at the end of the slider", async () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <Example onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[100]} />);

        await user.tab();
        await user.keyboard("{ArrowRight}");
        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onChangeEndSpy).toHaveBeenCalledWith([100]);

        await user.keyboard("{ArrowLeft}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([99]);
        expect(onChangeSpy).toHaveBeenCalledTimes(1);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([99]);
        expect(onChangeEndSpy).toHaveBeenCalledTimes(2);
        expect(values()).toEqual([99]);
      });

      it("can be moved with keys (vertical)", async () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <Example onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[10]} orientation="vertical" />);

        await user.tab();
        await user.keyboard("{ArrowRight}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([11]);
        expect(onChangeSpy).toHaveBeenCalledTimes(1);
        await user.keyboard("{ArrowUp}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([12]);
        expect(onChangeSpy).toHaveBeenCalledTimes(2);
        await user.keyboard("{ArrowDown}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([11]);
        expect(onChangeSpy).toHaveBeenCalledTimes(3);
        await user.keyboard("{ArrowLeft}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([10]);
        expect(onChangeSpy).toHaveBeenCalledTimes(4);
      });

      it("can be moved with keys (vertical) at the bottom of the slider", async () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <Example onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[0]} orientation="vertical" />);

        await user.tab();
        await user.keyboard("{ArrowDown}");
        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onChangeEndSpy).toHaveBeenCalledWith([0]);

        await user.keyboard("{ArrowUp}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([1]);
        expect(onChangeSpy).toHaveBeenCalledTimes(1);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([1]);
        expect(onChangeEndSpy).toHaveBeenCalledTimes(2);
        expect(values()).toEqual([1]);
      });

      it("can be moved with keys (vertical) at the top of the slider", async () => {
        const onChangeSpy = vi.fn();
        const onChangeEndSpy = vi.fn();
        render(() => <Example onChange={onChangeSpy} onChangeEnd={onChangeEndSpy} aria-label="Slider" defaultValue={[100]} orientation="vertical" />);

        await user.tab();
        await user.keyboard("{ArrowUp}");
        expect(onChangeSpy).not.toHaveBeenCalled();
        expect(onChangeEndSpy).toHaveBeenCalledWith([100]);

        await user.keyboard("{ArrowDown}");
        expect(onChangeSpy).toHaveBeenLastCalledWith([99]);
        expect(onChangeSpy).toHaveBeenCalledTimes(1);
        expect(onChangeEndSpy).toHaveBeenLastCalledWith([99]);
        expect(onChangeEndSpy).toHaveBeenCalledTimes(2);
        expect(values()).toEqual([99]);
      });
    });
  });
});
