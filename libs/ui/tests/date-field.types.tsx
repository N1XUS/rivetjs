// Type-level suite (`tsc -p libs/ui` only): `DateField` / `TimeField` / `DateInputGroup` parts accept the cdk props + `class` /
// `fullWidth` / `variant`, controlled value Signals, segment render children, `DateField["…Props"]`; errors: unknown `variant`, a
// non-function `DateField.Input` child.
import { CalendarDate, Time } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";
import { DateField } from "../src/components/date-field/index.ts";
import { DateInputGroup } from "../src/components/date-input-group/index.ts";
import { TimeField } from "../src/components/time-field/index.ts";

const value = signal<string | null>("2026-08-15");
const time = signal<string | null>("09:30:00");

export const ok = () => (
  <>
    <DateField
      name="date"
      value={value}
      minValue={new CalendarDate(2026, 1, 1)}
      granularity="day"
      fullWidth
      class="w-64"
      onChange={(v) => void v?.toString()}
      isRequired
    >
      <DateField.Group variant="secondary" fullWidth class="g">
        <DateField.Prefix>p</DateField.Prefix>
        <DateField.InputContainer>
          <DateField.Input class="i">{(segment) => <DateField.Segment class="s" segment={segment} />}</DateField.Input>
        </DateField.InputContainer>
        <DateField.Suffix>s</DateField.Suffix>
      </DateField.Group>
    </DateField>
    <TimeField name="time" value={time} defaultValue={new Time(9, 30)} hourCycle={24} granularity="second">
      <TimeField.Group>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
      </TimeField.Group>
    </TimeField>
    <DateInputGroup variant="primary">
      <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
    </DateInputGroup>
  </>
);

export const props: [DateField["Props"], DateField["GroupProps"], TimeField["Props"]] = [{}, { variant: "primary" }, { hourCycle: 12 }];

export const bad = () => (
  <>
    {/* @ts-expect-error unknown variant */}
    <DateField.Group variant="tertiary" />
    <DateField.Input>
      {/* @ts-expect-error a non-function child */}
      <span />
    </DateField.Input>
  </>
);
