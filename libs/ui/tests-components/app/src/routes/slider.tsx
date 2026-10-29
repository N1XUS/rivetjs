// Slider on a resumed page (P3-FORMS lane; upstream keyboard / focus-visible cases + the cdk free drag and Motion1D snap-on-release):
// `#before` button (Tab start), `vol` Slider (two-way value → `#vol-state`, `onChangeEnd` → `#vol-end`), stepped `step` Slider
// (step 10, value → `#step-state`), `range` Slider (two thumbs, `#range-state`); `sh-range` shorthand Slider (`label` only, two
// thumbs from the array value, `#sh-range-state`; UI identity T21); `marks` Slider (step 10 + Slider.Steps + Slider.Marks,
// value → `#marks-state`; UI-SLIDER) and a vertical twin `vmarks`.
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { Slider } from "@rivetjs/ui/slider";

export default function SliderStories() {
  const volume = signal(30);
  const ended = signal<number | number[] | null>(null);
  const stepped = signal(20);
  const range = signal([100, 500]);
  const span = signal([20, 60]);
  const marked = signal(40);
  return (
    <section class="flex w-80 flex-col gap-8 p-10">
      <button id="before" type="button">
        Before
      </button>
      <Slider data-testid="vol" value={volume} onChangeEnd={(v: number | number[]) => ended.set(v)}>
        <Label>Volume</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <span id="vol-state">{volume()}</span>
      <span id="vol-end">{String(ended())}</span>
      <Slider data-testid="step" step={10} value={stepped}>
        <Label>Stepped</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <span id="step-state">{stepped()}</span>
      <Slider data-testid="range" maxValue={1000} step={50} value={range}>
        <Label>Price Range</Label>
        <Slider.Output />
        <Slider.Track>
          {({ state }) => (
            <>
              <Slider.Fill />
              {state.defaultValues.map((_, i) => (
                <Slider.Thumb index={i} />
              ))}
            </>
          )}
        </Slider.Track>
      </Slider>
      <span id="range-state">{range().join(",")}</span>
      <Slider data-testid="sh-range" step={10} value={span} label="Span" />
      <span id="sh-range-state">{span().join(",")}</span>
      <Slider data-testid="marks" step={10} value={marked}>
        <Label>Marked</Label>
        <Slider.Output />
        <Slider.Track>
          <Slider.Fill />
          <Slider.Steps />
          <Slider.Thumb />
        </Slider.Track>
        <Slider.Marks>
          <Slider.Mark value={0}>Off</Slider.Mark>
          <Slider.Mark value={50} />
          <Slider.Mark value={100}>Max</Slider.Mark>
        </Slider.Marks>
      </Slider>
      <span id="marks-state">{marked()}</span>
      <div class="flex h-64 justify-center">
        <Slider data-testid="vmarks" class="h-full" defaultValue={0.4} maxValue={1} orientation="vertical" step={0.1}>
          <Label>Vertical</Label>
          <Slider.Output />
          <Slider.Track>
            <Slider.Fill />
            <Slider.Steps />
            <Slider.Thumb />
          </Slider.Track>
          <Slider.Marks>
            <Slider.Mark value={0} />
            <Slider.Mark value={0.5} />
            <Slider.Mark value={1} />
          </Slider.Marks>
        </Slider>
      </div>
    </section>
  );
}
