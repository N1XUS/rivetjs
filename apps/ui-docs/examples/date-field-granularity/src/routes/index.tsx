// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/date-field/granularity.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleQuestionMark } from "lucide";
import { DateField } from "@rivetjs/ui/date-field";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Tooltip } from "@rivetjs/ui/tooltip";

export const head = { title: "DateField: Granularity" };

// #region demo
import { parseDate, parseZonedDateTime } from "@rivetjs/cdk/date";
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/collections";
import { Show } from "@rivetjs/runtime/dom";

const granularityOptions = [
  { id: "day", label: "Day" },
  { id: "hour", label: "Hour" },
  { id: "minute", label: "Minute" },
  { id: "second", label: "Second" },
] as const;

export function Granularity() {
  // Rivet: the Select value is a two-way key signal (upstream: useState + onChange).
  const granularity = signal<Key | null>("day");

  return (
    <div class="flex gap-4">
      {/* Rivet: granularity is read once; a keyed Show re-creates the field per granularity (React re-renders). */}
      <Show keyed when={granularity() as "day" | "hour" | "minute" | "second"}>
        {(current) => (
          <DateField
            class="w-[256px]"
            // Determine appropriate default value based on granularity
            defaultValue={current() === "day" ? parseDate("2025-02-03") : parseZonedDateTime("2025-02-03T08:45:00[America/Los_Angeles]")}
            granularity={current()}
            name="granularity-date"
          >
            <Label>Appointment Date</Label>
            <DateField.Group>
              <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
            </DateField.Group>
          </DateField>
        )}
      </Show>
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <Label>Granularity</Label>
          <Tooltip delay={0}>
            <Tooltip.Trigger aria-label="Granularity information">
              <Icon icon={CircleQuestionMark} size={16} class="size-4 text-muted" />
            </Tooltip.Trigger>
            <Tooltip.Content placement="bottom start">
              <p>Determines the smallest unit displayed in the date picker. By default, this is "day" for dates, and "minute" for times.</p>
            </Tooltip.Content>
          </Tooltip>
        </div>
        <Select class="w-[110px]" placeholder="Select granularity" value={granularity} variant="secondary">
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {granularityOptions.map((option) => (
                <ListBox.Item id={option.id} textValue={option.label}>
                  {option.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Granularity />
    </div>
  );
}
