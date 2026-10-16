// Rivet-authored TimePicker demo (Rivet addition, no HeroUI counterpart): a TimeField whose clock button opens wheel drums.
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";
import { TimePicker } from "@rivetjs/ui/time-picker";

export const head = { title: "TimeField: Time Picker" };

// #region demo
import { signal } from "@rivetjs/reactivity";

export function TimePickerDemo() {
  const value = signal<string | null>("07:30:00");

  return (
    <TimePicker class="w-[256px]" id="alarm" name="alarm" value={value}>
      <Label>Alarm</Label>
      <TimeField.Group>
        <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
        <TimeField.Suffix>
          <TimePicker.Trigger id="alarm-trigger" aria-label="Choose time">
            <TimePicker.TriggerIndicator />
          </TimePicker.Trigger>
        </TimeField.Suffix>
      </TimeField.Group>
      <Description id="alarm-value">Value: {value() ?? "none"}</Description>
      {/* Render function: the drums are created (and their code loaded) when the popover opens. */}
      <TimePicker.Popover>{() => <TimePicker.Wheels id="alarm-wheels" aria-label="Alarm" />}</TimePicker.Popover>
    </TimePicker>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh justify-center p-6 pt-12 [:where(&>*)]:max-w-full">
      <TimePickerDemo />
    </div>
  );
}
