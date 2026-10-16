// Rivet deviation tests (user decision 2026-10-08, same as `slider-snap.browser.test.tsx`): a ColorSlider thumb drags
// freely and animates to the closest channel step on release (`snap="release"`, default; `data-snapping` /
// `isSnapping()` on ColorThumb); `snap="drag"` keeps React Aria's snap-during-drag. Hue channel (0–360, step 1) on a
// mocked 100px track: pointer 13px = 13% free = 46.8° → value 47° (stepped position 47 / 360).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { ColorSlider, type ColorSliderProps } from "../color-slider/index.tsx";
import { ColorThumb, type ColorThumbProps } from "../color-thumb/index.tsx";
import { SliderTrack } from "../slider/index.tsx";
import type { Color } from "../color/index.ts";

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
const STEP_47 = (47 / 360) * 100;

function renderSlider(props: Partial<ColorSliderProps> = {}, thumbProps: ColorThumbProps = {}) {
  const { container } = render(() => (
    <ColorSlider defaultValue="hsl(0, 100%, 50%)" channel="hue" {...props}>
      <SliderTrack>
        <ColorThumb {...thumbProps} />
      </SliderTrack>
    </ColorSlider>
  ));
  const q = within(container as HTMLElement);
  const input = q.getByRole("slider") as HTMLInputElement;
  return { input, thumb: input.parentElement as HTMLElement, track: q.getByRole("group") };
}

const hue = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([c]) => (c as Color).getChannelValue("hue"));

describe('ColorSlider snap="release" (default)', () => {
  it("thumb follows the pointer while the channel value stays stepped", () => {
    const onChange = vi.fn();
    const { input, thumb } = renderSlider({ onChange });
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 13 });
    expect(parseFloat(thumb.style.left)).toBeCloseTo(13);
    expect(input).toHaveValue("47");
    expect(hue(onChange)).toEqual([47]);
    expect(thumb.style.transition).toBe("");
    pointer("pointerup", thumb, { clientX: 13 });
  });

  it("release animates to the stepped position (Motion1D, data-snapping), then ends", async () => {
    const onChangeEnd = vi.fn();
    const { thumb } = renderSlider({ onChangeEnd });
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 13 });
    pointer("pointerup", thumb, { clientX: 13 });
    expect(hue(onChangeEnd)).toEqual([47]);
    expect(thumb).toHaveAttribute("data-snapping", "true");
    expect(parseFloat(thumb.style.left)).toBeCloseTo(13);
    await frame();
    await frame();
    await settled(thumb);
    expect(parseFloat(thumb.style.left)).toBeCloseTo(STEP_47);
  });

  it("track press: free position from the press point, snaps on release", async () => {
    const { input, thumb, track } = renderSlider();
    pointer("pointerdown", track, { clientX: 13 });
    expect(parseFloat(thumb.style.left)).toBeCloseTo(13);
    expect(input).toHaveValue("47");
    pointer("pointerup", track, { clientX: 13 });
    expect(thumb).toHaveAttribute("data-snapping", "true");
    await settled(thumb);
    expect(parseFloat(thumb.style.left)).toBeCloseTo(STEP_47);
  });

  it("render props expose isSnapping", async () => {
    const { thumb } = renderSlider({}, { class: ({ isSnapping }) => (isSnapping() ? "thumb snapping" : "thumb") });
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 13 });
    expect(thumb).not.toHaveClass("snapping");
    pointer("pointerup", thumb, { clientX: 13 });
    expect(thumb).toHaveClass("snapping");
    await settled(thumb);
    expect(thumb).not.toHaveClass("snapping");
  });

  it("keyboard changes stay stepped (no free position, no animation)", async () => {
    const user = userEvent.setup();
    const { input, thumb } = renderSlider();
    input.focus();
    await user.keyboard("{ArrowRight}");
    expect(input).toHaveValue("1");
    expect(parseFloat(thumb.style.left)).toBeCloseTo((1 / 360) * 100);
    expect(thumb).not.toHaveAttribute("data-snapping");
  });
});

describe('ColorSlider snap="drag" (React Aria)', () => {
  it("thumb sits on the step during the drag; no animation", () => {
    const { input, thumb } = renderSlider({ snap: "drag" });
    pointer("pointerdown", thumb, { clientX: 0 });
    pointer("pointermove", thumb, { clientX: 13 });
    expect(parseFloat(thumb.style.left)).toBeCloseTo(STEP_47);
    expect(input).toHaveValue("47");
    pointer("pointerup", thumb, { clientX: 13 });
    expect(thumb).not.toHaveAttribute("data-snapping");
  });
});
