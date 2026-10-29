// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: With Description" };

// #region demo
export function WithDescription() {
  return (
    <NativeSelect class="w-64" defaultValue="30">
      <Label>Auto-lock</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="5">After 5 minutes</NativeSelect.Option>
        <NativeSelect.Option value="30">After 30 minutes</NativeSelect.Option>
        <NativeSelect.Option value="0">Never</NativeSelect.Option>
      </NativeSelect.Trigger>
      <Description>Locks the app when you are away</Description>
    </NativeSelect>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
