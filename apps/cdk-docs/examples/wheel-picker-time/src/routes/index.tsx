import { Clock } from "lucide";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { DateInput, DateSegment, TimeField, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { DialogTrigger } from "@rivetjs/cdk/dialog";
import { Group } from "@rivetjs/cdk/group";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";
import { Label } from "@rivetjs/cdk/label";
import { Popover } from "@rivetjs/cdk/popover";
import { TimeWheels } from "@rivetjs/cdk/time-wheels";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "TimeWheels" };

// #region demo
export default function AlarmTime() {
  const time = signal<string | null>("07:30:00");
  return (
    <I18nProvider locale="en-US">
      <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
        <TimeField id="alarm" value={time}>
          <Label>Alarm</Label>
          <DialogTrigger>
            <Group class="picker">
              <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
              <Button id="alarm-wheels-button" aria-label="Choose time">
                <Icon icon={Clock} size={16} />
              </Button>
            </Group>
            <Popover placement="bottom end">
              {/* Render function: the drums are created when the popover opens. */}
              {() => <TimeWheels id="alarm-wheels" aria-label="Alarm" />}
            </Popover>
          </DialogTrigger>
        </TimeField>
        <p id="value" class="text-slate-600">
          Value: {time() ?? "none"}
        </p>
      </section>
    </I18nProvider>
  );
}
// #endregion
