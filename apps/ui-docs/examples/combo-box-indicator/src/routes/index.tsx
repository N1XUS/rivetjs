// Rivet example (no HeroUI counterpart): the default morph indicator (TWEAKS.md TW-149) and its style hooks.
import { ComboBox } from "@rivetjs/ui/combo-box";

export const head = { title: "ComboBox: Indicator" };

// #region demo
export function Indicator() {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <ComboBox class="w-[200px]" label="Default" placeholder="Search states">
        <ComboBox.Item id="florida">Florida</ComboBox.Item>
        <ComboBox.Item id="texas">Texas</ComboBox.Item>
        <ComboBox.Item id="new-york">New York</ComboBox.Item>
      </ComboBox>
      <ComboBox
        class="w-[200px] [--combo-box-indicator-size:20px] [--combo-box-indicator-stroke:2px] [--combo-box-indicator-duration:640ms]"
        label="Larger, slower"
        placeholder="Search states"
      >
        <ComboBox.Item id="florida">Florida</ComboBox.Item>
        <ComboBox.Item id="texas">Texas</ComboBox.Item>
        <ComboBox.Item id="new-york">New York</ComboBox.Item>
      </ComboBox>
      <ComboBox class="w-[200px] [--combo-box-indicator-duration:0s]" label="No morph" placeholder="Search states">
        <ComboBox.Item id="florida">Florida</ComboBox.Item>
        <ComboBox.Item id="texas">Texas</ComboBox.Item>
        <ComboBox.Item id="new-york">New York</ComboBox.Item>
      </ComboBox>
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
