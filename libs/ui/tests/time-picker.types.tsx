// Type-level checks for `@rivetjs/ui/time-picker` (tsc -p libs/ui only).
import { signal } from "@rivetjs/reactivity";
import { TimePicker } from "../src/components/time-picker/index.ts";
import type { TimePickerProps } from "../src/components/time-picker/index.ts";
import { TimeField } from "../src/components/time-field/index.ts";

const open = signal(false);
const value = signal<string | null>("07:30:00");

export const ok = () => (
  <TimePicker value={value} isOpen={open} onOpenChange={(o: boolean) => void o} granularity="second">
    <TimeField.Group>
      <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
      <TimeField.Suffix>
        <TimePicker.Trigger aria-label="Choose time">
          <TimePicker.TriggerIndicator class="x" />
        </TimePicker.Trigger>
      </TimeField.Suffix>
    </TimeField.Group>
    <TimePicker.Popover placement="top">{() => <TimePicker.Wheels minuteStep={5} secondStep={10} loop={false} visibleItems={7} />}</TimePicker.Popover>
  </TimePicker>
);

export const defaults = () => (
  <TimePicker defaultOpen>
    <TimePicker.Popover />
  </TimePicker>
);

const props: TimePickerProps = { defaultValue: "12:00:00", defaultOpen: true };
void props;

// @ts-expect-error minuteStep is a number
export const bad = () => <TimePicker.Wheels minuteStep="5" />;
