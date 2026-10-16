// Rivet addition (no upstream demo): ComboBox shorthand, same parts as the compound form.
import { ComboBox } from "@rivetjs/ui/combo-box";

export const head = { title: "ComboBox: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <ComboBox class="w-[256px]" label="State" placeholder="Search states" description="Type to filter">
      <ComboBox.Item id="florida">Florida</ComboBox.Item>
      <ComboBox.Item id="texas">Texas</ComboBox.Item>
      <ComboBox.Item id="new-york">New York</ComboBox.Item>
    </ComboBox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
