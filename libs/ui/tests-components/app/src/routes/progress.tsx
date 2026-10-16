// Port of HeroUI v3.2.6 progress-bar / progress-circle / meter stories (Default, Sizes, Colors, Indeterminate, CustomValue,
// WithoutLabel / WithLabel; one root id per story case `#pb-…` / `#pc-…` / `#m-…`) + live props on a resumed page: `#p-next`
// steps `value` 25 → 50 → 75 → 100 → 25 for `#pb-live` / `#pc-live` / `#m-live`, `#p-ind` toggles `isIndeterminate` of the
// live bar + circle, `#p-color` toggles their `color` accent ↔ danger.
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { ProgressCircle } from "@rivetjs/ui/progress-circle";

export const head = { title: "Progress" };

const COLORS = ["default", "accent", "success", "warning", "danger"] as const;
const SIZES = ["sm", "md", "lg"] as const;

export default function ProgressStories() {
  const value = signal(25);
  const indeterminate = signal(false);
  const color = signal<"accent" | "danger">("accent");
  return (
    <main class="flex w-96 flex-col gap-6 p-8">
      <button id="p-next" type="button" onClick={() => value.set(value() >= 100 ? 25 : value() + 25)}>
        next
      </button>
      <button id="p-ind" type="button" onClick={() => indeterminate.set(!indeterminate())}>
        indeterminate
      </button>
      <button id="p-color" type="button" onClick={() => color.set(color() === "accent" ? "danger" : "accent")}>
        color
      </button>

      <ProgressBar id="pb-live" value={value()} isIndeterminate={indeterminate()} color={color()}>
        <Label>Live</Label>
        <ProgressBar.Output id="pb-live-output" />
        <ProgressBar.Track>
          <ProgressBar.Fill id="pb-live-fill" />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressCircle id="pc-live" aria-label="Live" value={value()} isIndeterminate={indeterminate()} color={color()}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle id="pc-live-fill" />
        </ProgressCircle.Track>
      </ProgressCircle>
      <Meter id="m-live" value={value()}>
        <Label>Live meter</Label>
        <Meter.Output id="m-live-output" />
        <Meter.Track>
          <Meter.Fill id="m-live-fill" />
        </Meter.Track>
      </Meter>

      <ProgressBar id="pb-default" value={60}>
        <Label>Loading</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      {SIZES.map((size) => (
        <ProgressBar id={`pb-size-${size}`} size={size} value={40}>
          <Label>{size}</Label>
          <ProgressBar.Output />
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      ))}
      {COLORS.map((c) => (
        <ProgressBar id={`pb-color-${c}`} color={c} value={50}>
          <Label>{c}</Label>
          <ProgressBar.Output />
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      ))}
      <ProgressBar id="pb-indeterminate" isIndeterminate>
        <Label>Loading...</Label>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar id="pb-custom" formatOptions={{ style: "currency", currency: "USD" }} maxValue={1000} minValue={0} value={750}>
        <Label>Revenue</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar id="pb-nolabel" aria-label="Loading progress" value={45}>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>

      <ProgressCircle id="pc-default" aria-label="Loading" value={60}>
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>
      {COLORS.map((c) => (
        <ProgressCircle id={`pc-color-${c}`} aria-label={c} color={c} value={70}>
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      ))}
      <ProgressCircle id="pc-indeterminate" isIndeterminate aria-label="Loading">
        <ProgressCircle.Track>
          <ProgressCircle.TrackCircle />
          <ProgressCircle.FillCircle />
        </ProgressCircle.Track>
      </ProgressCircle>

      <Meter id="m-default" value={60}>
        <Label>Storage</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter id="m-custom" formatOptions={{ style: "currency", currency: "USD" }} maxValue={1000} minValue={0} value={750}>
        <Label>Budget</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Meter id="m-nolabel" aria-label="Storage" value={45}>
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </main>
  );
}
