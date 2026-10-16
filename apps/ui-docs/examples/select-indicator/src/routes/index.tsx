// Rivet example (no HeroUI counterpart): the default morph indicator (TWEAKS.md TW-149) and its style hooks.
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Indicator" };

// #region demo
export function Indicator() {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <Select class="w-[200px]" label="Default" placeholder="Select one">
        <Select.Item id="florida">Florida</Select.Item>
        <Select.Item id="texas">Texas</Select.Item>
        <Select.Item id="new-york">New York</Select.Item>
      </Select>
      <Select
        class="w-[200px] [--select-indicator-size:20px] [--select-indicator-stroke:2px] [--select-indicator-duration:640ms]"
        label="Larger, slower"
        placeholder="Select one"
      >
        <Select.Item id="florida">Florida</Select.Item>
        <Select.Item id="texas">Texas</Select.Item>
        <Select.Item id="new-york">New York</Select.Item>
      </Select>
      <Select class="w-[200px] [--select-indicator-duration:0s]" label="No morph" placeholder="Select one">
        <Select.Item id="florida">Florida</Select.Item>
        <Select.Item id="texas">Texas</Select.Item>
        <Select.Item id="new-york">New York</Select.Item>
      </Select>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Indicator />
    </div>
  );
}
