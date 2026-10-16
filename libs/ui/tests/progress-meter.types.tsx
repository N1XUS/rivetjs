// Type-level tests, checked by `tsc -p libs/ui`: ProgressBar / ProgressCircle / Meter keep HeroUI's props (cdk ProgressBar / Meter props
// + color / size variants), generic dom parts, compound statics.
import { Meter } from "../src/components/meter/index.ts";
import { ProgressBar } from "../src/components/progress-bar/index.ts";
import { ProgressCircle } from "../src/components/progress-circle/index.ts";

export const Bars = () => (
  <>
    <ProgressBar value={60} minValue={0} maxValue={100} color="success" size="lg" isIndeterminate={false} class="x" ref={(el: HTMLDivElement) => void el}>
      <ProgressBar.Output<"output"> ref={(el: HTMLOutputElement) => void el} />
      <ProgressBar.Track ref={(el: HTMLDivElement) => void el}>
        <ProgressBar.Fill style={{ opacity: 0.5 }} />
      </ProgressBar.Track>
    </ProgressBar>
    <ProgressBar aria-label="x" formatOptions={{ style: "currency", currency: "USD" }}>
      {({ percentage, valueText, isIndeterminate }) => <i>{`${percentage()}${valueText()}${isIndeterminate()}`}</i>}
    </ProgressBar>
    <ProgressCircle aria-label="c" value={10} color="warning" size="sm">
      <ProgressCircle.Track class="t">
        <ProgressCircle.TrackCircle ref={(el: SVGCircleElement) => void el} />
        <ProgressCircle.FillCircle />
      </ProgressCircle.Track>
    </ProgressCircle>
    <Meter value={3} maxValue={4} valueLabel="3 of 4" color="danger" size="md">
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  </>
);

export type Props = [ProgressBar["Props"], ProgressBar["FillProps"], ProgressCircle["FillCircleProps"], Meter["OutputProps"]];

// @ts-expect-error bad progress-bar color
export const BadColor = () => <ProgressBar color="nope" />;
// @ts-expect-error bad progress-circle size
export const BadSize = () => <ProgressCircle size="xl" />;
// @ts-expect-error a meter has no indeterminate state (RAC Meter)
export const BadMeter = () => <Meter isIndeterminate />;
