// Type-level suite (`tsc -p libs/ui` only): `NumberStepper` props (size union, value number / Signal, NumberField props),
// Value `format` + render-function children, button props (no `slot`); errors: bad size, `slot` on a button.
import { signal } from "@rivetjs/reactivity";
import { NumberStepper } from "../src/components/number-stepper/index.ts";
import type { NumberStepperProps } from "../src/components/number-stepper/index.ts";

const props: NumberStepper["Props"] = { size: "sm", defaultValue: 1, minValue: 0, maxValue: 9, step: 1, formatOptions: { style: "percent" } };
const rootProps: NumberStepperProps = props;
const value = signal<number | null>(2);

export const ok = () => (
  <>
    <NumberStepper {...rootProps} aria-label="A" onChange={(v: number) => void v}>
      <NumberStepper.Group class="g">
        <NumberStepper.DecrementButton aria-label="Less" />
        <NumberStepper.Value format={(v) => `${v ?? 0}%`} wrapperClass="w" />
        <NumberStepper.IncrementButton>+</NumberStepper.IncrementButton>
      </NumberStepper.Group>
    </NumberStepper>
    <NumberStepper value={value} aria-label="B" isDisabled>
      <NumberStepper.Group>
        <NumberStepper.Value>{({ value, text }) => <span>{`${value()} / ${text()}`}</span>}</NumberStepper.Value>
      </NumberStepper.Group>
    </NumberStepper>
  </>
);

// @ts-expect-error unknown size
export const badSize = () => <NumberStepper size="xl" />;
// @ts-expect-error the slot is fixed
export const badSlot = () => <NumberStepper.IncrementButton slot="decrement" />;
