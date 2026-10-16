// Rivet-authored TimePicker demo (Rivet addition, no HeroUI counterpart): 24-hour drums with seconds, steps and a time range.
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";
import { TimePicker } from "@rivetjs/ui/time-picker";

export const head = { title: "TimeField: Time Picker Options" };

// #region demo
import { signal } from "@rivetjs/reactivity";

export function TimePickerOptions() {
  const value = signal<string | null>("17:30:00");

  return (
    <I18nProvider locale="de-DE">
      <TimePicker class="w-[256px]" granularity="second" id="pickup" maxValue="18:00:00" minValue="08:00:00" value={value}>
        <Label>Pickup time</Label>
        <TimeField.Group>
          <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>
          <TimeField.Suffix>
            <TimePicker.Trigger id="pickup-trigger" aria-label="Choose time">
              <TimePicker.TriggerIndicator />
            </TimePicker.Trigger>
          </TimeField.Suffix>
        </TimeField.Group>
        <Description id="pickup-value">Value: {value() ?? "none"}</Description>
        <TimePicker.Popover>{() => <TimePicker.Wheels id="pickup-wheels" aria-label="Pickup time" minuteStep={5} secondStep={15} />}</TimePicker.Popover>
      </TimePicker>
    </I18nProvider>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh justify-center p-6 pt-12 [:where(&>*)]:max-w-full">
      <TimePickerOptions />
    </div>
  );
}
