// Rivet deviation tests (user decision 2026-10-08): stepped sliders drag freely and animate to the closest
// step on release (`snap="release"`, default); `snap="drag"` keeps React Aria's snap-during-drag.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { I18nProvider } from "../i18n/i18n-provider.tsx";
import { Label } from "../label/index.tsx";
import { Slider, SliderFill, SliderOutput, SliderThumb, SliderTrack, type SliderProps } from "../slider/index.tsx";

afterEach(cleanup);

let rectSpy: ReturnType<typeof vi.spyOn> | undefined;
beforeAll(() => {
  rectSpy = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({ top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0 }) as DOMRect);
});
afterAll(() => rectSpy?.mockRestore());

const pointer = (type: string, target: EventTarget, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, ...init }));
const frame = () => new Promise(requestAnimationFrame);
const settled = (el: HTMLElement) => vi.waitFor(() => expect(el).not.toHaveAttribute("data-snapping"), { timeout: 2000, interval: 10 });

function renderSlider(props: Partial<SliderProps<any>> = {}, thumbs = 1, locale?: string) {
  const slider = () => (
    <Slider step={10} {...props}>
      <Label>Size</Label>
      <SliderOutput />
      <SliderTrack>
        <SliderFill />
        {Array.from({ length: thumbs }, (_, i) => (
          <SliderThumb index={i} />
        ))}
      </SliderTrack>
    </Slider>
  );
  const { container } = render(() => (locale ? <I18nProvider locale={locale}>{slider()}</I18nProvider> : slider()));
  const q = within(container as HTMLElement);
  const inputs = q.getAllByRole("slider") as HTMLInputElement[];
  const thumbEls = inputs.map((input) => input.closest(".rv-SliderThumb") as HTMLElement);
  return {
    inputs,
    thumbs: thumbEls,
    track: (container as HTMLElement).querySelector(".rv-SliderTrack") as HTMLElement,
    fill: (container as HTMLElement).querySelector(".rv-SliderFill") as HTMLElement,
    output: q.getByRole("status"),
  };
}

describe('Slider snap="release" (default)', () => {
  it("thumb and fill follow the pointer while the value stays stepped; onChange per step", () => {
    const onChange = vi.fn();
    const { inputs, thumbs, fill, output } = renderSlider({ defaultValue: 0, onChange });
    const thumb = thumbs[0]!;
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 13 });
    expect(thumb.style.left).toBe("13%");
    expect(fill.style.width).toBe("13%");
    expect(inputs[0]).toHaveValue("10");
    expect(inputs[0]).toHaveAttribute("aria-valuetext", "10");
    expect(output).toHaveTextContent("10");
    expect(thumb.style.transition).toBe("");

    pointer("pointermove", thumb, { clientX: 14 });
    expect(thumb.style.left).toBe("14%");
    expect(inputs[0]).toHaveValue("10");
    pointer("pointermove", thumb, { clientX: 17 });
    expect(thumb.style.left).toBe("17%");
    expect(inputs[0]).toHaveValue("20");
    // onChange only on stepped changes: 0 → 10 → 20.
    expect(onChange.mock.calls).toEqual([[10], [20]]);
    pointer("pointerup", thumb, { clientX: 17 });
  });

  it("release animates to the stepped position (Motion1D, data-snapping), then ends", async () => {
    const onChangeEnd = vi.fn();
    const { thumbs, fill } = renderSlider({ defaultValue: 0, onChangeEnd });
    const thumb = thumbs[0]!;
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 17 });
    pointer("pointerup", thumb, { clientX: 17 });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    expect(onChangeEnd).toHaveBeenLastCalledWith(20);
    expect(thumb).toHaveAttribute("data-snapping", "true");
    expect(fill).toHaveAttribute("data-snapping", "true");
    // The animation starts from the free position; no CSS transition.
    expect(thumb.style.left).toBe("17%");
    expect(thumb.style.transition).toBe("");
    expect(fill.style.transition).toBe("");

    await settled(thumb);
    expect(fill).not.toHaveAttribute("data-snapping");
    expect(thumb.style.transition).toBe("");
    expect(thumb.style.left).toBe("20%");
    expect(fill.style.width).toBe("20%");
  });

  it("frames move the thumb and fill from the free position towards the step", async () => {
    const { thumbs, fill } = renderSlider({ defaultValue: 0 });
    const thumb = thumbs[0]!;
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 17 });
    pointer("pointerup", thumb, { clientX: 17 });
    await frame();
    await frame();
    await frame();
    const left = parseFloat(thumb.style.left);
    expect(left).toBeGreaterThan(17);
    expect(left).toBeLessThan(20);
    expect(parseFloat(fill.style.width)).toBeCloseTo(left);
    await settled(thumb);
    expect(thumb.style.left).toBe("20%");
  });

  it("a new drag during the snap cancels it", async () => {
    const { thumbs } = renderSlider({ defaultValue: 0 });
    const thumb = thumbs[0]!;
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 17 });
    pointer("pointerup", thumb, { clientX: 17 });
    expect(thumb).toHaveAttribute("data-snapping", "true");
    pointer("pointerdown", thumb, { clientX: 17 });
    pointer("pointermove", thumb, { clientX: 43 });
    expect(thumb).not.toHaveAttribute("data-snapping");
    await frame();
    await frame();
    expect(thumb.style.left).toBe("46%"); // thumb drags relative to its value (20 + 26)
    pointer("pointerup", thumb, { clientX: 43 });
    await settled(thumb);
    expect(thumb.style.left).toBe("50%");
  });

  it("no animation when the pointer already sits on a step", () => {
    const { thumbs } = renderSlider({ defaultValue: 0 });
    const thumb = thumbs[0]!;
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 30 });
    pointer("pointerup", thumb, { clientX: 30 });
    expect(thumb).not.toHaveAttribute("data-snapping");
    expect(thumb.style.left).toBe("30%");
  });

  it("prefers-reduced-motion: no animation", () => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...real.call(window, query), matches: query.includes("reduce"), media: query })) as typeof window.matchMedia;
    try {
      const { thumbs } = renderSlider({ defaultValue: 0 });
      const thumb = thumbs[0]!;
      pointer("pointerdown", thumb, { clientX: 0 });
      pointer("pointermove", thumb, { clientX: 17 });
      expect(thumb.style.left).toBe("17%");
      pointer("pointerup", thumb, { clientX: 17 });
      expect(thumb).not.toHaveAttribute("data-snapping");
      expect(thumb.style.left).toBe("20%");
    } finally {
      window.matchMedia = real;
    }
  });

  it("track press then drag: free position from the press point", async () => {
    const onChange = vi.fn();
    const { inputs, thumbs, track } = renderSlider({ defaultValue: 0, onChange });
    const thumb = thumbs[0]!;
    pointer("pointerdown", track, { clientX: 13 });
    expect(thumb.style.left).toBe("13%");
    expect(inputs[0]).toHaveValue("10");
    pointer("pointermove", track, { clientX: 22 });
    expect(thumb.style.left).toBe("22%");
    expect(inputs[0]).toHaveValue("20");
    pointer("pointerup", track, { clientX: 22 });
    expect(thumb).toHaveAttribute("data-snapping", "true");
    await settled(thumb);
    expect(thumb.style.left).toBe("20%");
    expect(onChange.mock.calls).toEqual([[10], [20]]);
  });

  it("multi-thumb: free position clamped to the neighbouring thumbs; range fill follows", () => {
    const { inputs, thumbs, fill } = renderSlider({ defaultValue: [20, 50] }, 2);
    pointer("pointerdown", thumbs[1]!, { clientX: 50 });
    pointer("pointermove", thumbs[1]!, { clientX: 37 });
    expect(thumbs[1]!.style.left).toBe("37%");
    expect(inputs[1]).toHaveValue("40");
    expect(fill.style.insetInlineStart).toBe("20%");
    expect(fill.style.width).toBe("17%");
    pointer("pointermove", thumbs[1]!, { clientX: 5 });
    expect(thumbs[1]!.style.left).toBe("20%");
    expect(inputs[1]).toHaveValue("20");
    pointer("pointerup", thumbs[1]!, { clientX: 5 });
    expect(thumbs[1]).not.toHaveAttribute("data-snapping");

    pointer("pointerdown", thumbs[0]!, { clientX: 20 });
    pointer("pointermove", thumbs[0]!, { clientX: 90 });
    expect(thumbs[0]!.style.left).toBe("20%");
    pointer("pointermove", thumbs[0]!, { clientX: -40 });
    expect(thumbs[0]!.style.left).toBe("0%");
    pointer("pointerup", thumbs[0]!, { clientX: -40 });
  });

  it("RTL: free position mirrored", async () => {
    const { inputs, thumbs } = renderSlider({ defaultValue: 0 }, 1, "he-IL");
    const thumb = thumbs[0]!;
    expect(thumb.style.left).toBe("100%");
    pointer("pointerdown", thumb, { clientX: 100 });
    pointer("pointermove", thumb, { clientX: 87 });
    expect(inputs[0]).toHaveValue("10");
    expect(parseFloat(thumb.style.left)).toBeCloseTo(87);
    pointer("pointerup", thumb, { clientX: 87 });
    expect(thumb).toHaveAttribute("data-snapping", "true");
    await settled(thumb);
    expect(thumb.style.left).toBe("90%");
  });

  it("vertical: free position on top, fill bottom / height", async () => {
    const { inputs, thumbs, fill } = renderSlider({ defaultValue: 0, orientation: "vertical" });
    const thumb = thumbs[0]!;
    expect(thumb.style.top).toBe("100%");
    pointer("pointerdown", thumb, { clientY: 100 });
    pointer("pointermove", thumb, { clientY: 87 });
    expect(inputs[0]).toHaveValue("10");
    expect(parseFloat(thumb.style.top)).toBeCloseTo(87);
    expect(parseFloat(fill.style.height)).toBeCloseTo(13);
    pointer("pointerup", thumb, { clientY: 87 });
    expect(thumb).toHaveAttribute("data-snapping", "true");
    await settled(thumb);
    expect(thumb.style.top).toBe("90%");
    expect(parseFloat(fill.style.height)).toBeCloseTo(10);
  });

  it("keyboard changes stay stepped (no free position, no animation)", async () => {
    const user = userEvent.setup();
    const { inputs, thumbs } = renderSlider({ defaultValue: 0 });
    await user.click(inputs[0]!);
    inputs[0]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(inputs[0]).toHaveValue("10");
    expect(thumbs[0]!.style.left).toBe("10%");
    expect(thumbs[0]).not.toHaveAttribute("data-snapping");
  });

  it("render props expose isSnapping", async () => {
    const { container } = render(() => (
      <Slider step={10} defaultValue={0} aria-label="Size">
        <SliderTrack>
          <SliderThumb class={({ isSnapping }) => (isSnapping() ? "thumb snapping" : "thumb")} />
        </SliderTrack>
      </Slider>
    ));
    const thumb = (container as HTMLElement).querySelector(".thumb") as HTMLElement;
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 17 });
    expect(thumb).not.toHaveClass("snapping");
    pointer("pointerup", thumb, { clientX: 17 });
    expect(thumb).toHaveClass("snapping");
    await settled(thumb);
    expect(thumb).not.toHaveClass("snapping");
  });
});

describe('Slider snap="drag" (React Aria)', () => {
  it("thumb jumps from step to step during the drag; same onChange calls; no animation", () => {
    const onChange = vi.fn();
    const { inputs, thumbs, fill } = renderSlider({ defaultValue: 0, onChange, snap: "drag" });
    const thumb = thumbs[0]!;
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 13 });
    expect(thumb.style.left).toBe("10%");
    expect(fill.style.width).toBe("10%");
    pointer("pointermove", thumb, { clientX: 14 });
    pointer("pointermove", thumb, { clientX: 17 });
    expect(thumb.style.left).toBe("20%");
    expect(inputs[0]).toHaveValue("20");
    expect(onChange.mock.calls).toEqual([[10], [20]]);
    pointer("pointerup", thumb, { clientX: 17 });
    expect(thumb).not.toHaveAttribute("data-snapping");
    expect(thumb.style.left).toBe("20%");
  });

  it("track press: thumb at the stepped value", () => {
    const { thumbs, track } = renderSlider({ defaultValue: 0, snap: "drag" });
    pointer("pointerdown", track, { clientX: 13 });
    expect(thumbs[0]!.style.left).toBe("10%");
    pointer("pointerup", track, { clientX: 13 });
    expect(thumbs[0]).not.toHaveAttribute("data-snapping");
  });
});
