// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-bar/custom-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { NumberField } from "@rivetjs/ui/number-field";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { Select } from "@rivetjs/ui/select";
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "ProgressBar: Custom Value Scale" };

// #region demo
const formatStyleOptions: { label: string; key: string }[] = [
  { label: "Currency", key: "currency" },
  { label: "Percent", key: "percent" },
  { label: "Decimal", key: "decimal" },
  { label: "Unit", key: "unit" },
];

const formatOptionsMap: Record<string, Intl.NumberFormatOptions> = {
  currency: { currency: "USD", style: "currency" },
  decimal: { style: "decimal" },
  percent: { style: "percent" },
  unit: { style: "unit", unit: "mile" },
};

// The NumberField bounds are accessors (the cdk number-field state reads them lazily); `format` is a two-way signal.
export function CustomValue() {
  const value = signal<number | null>(750);
  const minValue = signal<number | null>(0);
  const maxValue = signal<number | null>(1000);
  const format = signal<Key | null>("percent");

  return (
    <div class="flex w-full flex-col gap-6 md:flex-row md:items-center md:gap-10">
      <div class="flex w-full max-w-md flex-1 justify-center">
        <ProgressBar
          aria-label="Revenue"
          class="w-full max-w-52"
          formatOptions={formatOptionsMap[String(format())]}
          maxValue={maxValue() ?? 1000}
          minValue={minValue() ?? 0}
          value={value() ?? 0}
        >
          <Label>Progress</Label>
          <ProgressBar.Output />
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </div>
      <Separator class="md:hidden" />
      <Separator class="hidden md:block" orientation="vertical" />
      <div class="flex max-w-52 flex-col gap-3">
        <Label class="text-xs font-medium text-muted">Options</Label>
        <NumberField maxValue={() => maxValue() ?? 1000} minValue={() => minValue() ?? 0} value={value} variant="secondary">
          <Label>Value</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          maxValue={() => (maxValue() ?? 1000) - 1}
          minValue={0}
          value={minValue}
          variant="secondary"
          onChange={(v: number) => {
            if ((value() ?? 0) < v) value.set(v);
          }}
        >
          <Label>Min Value</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          maxValue={2000}
          minValue={() => (minValue() ?? 0) + 1}
          value={maxValue}
          variant="secondary"
          onChange={(v: number) => {
            if ((value() ?? 0) > v) value.set(v);
          }}
        >
          <Label>Max Value</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <Select value={format} variant="secondary">
          <Label>Format</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {formatStyleOptions.map((option) => (
                <ListBox.Item id={option.key} textValue={option.label}>
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
      <CustomValue />
    </div>
  );
}
