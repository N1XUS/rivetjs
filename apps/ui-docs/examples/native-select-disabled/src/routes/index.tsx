// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Disabled Select" };

// #region demo
export function Disabled() {
  return (
    <NativeSelect class="w-64" defaultValue="standard" isDisabled>
      <Label>Shipping</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="standard">Standard (3-5 days)</NativeSelect.Option>
        <NativeSelect.Option value="express">Express (1-2 days)</NativeSelect.Option>
      </NativeSelect.Trigger>
    </NativeSelect>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
