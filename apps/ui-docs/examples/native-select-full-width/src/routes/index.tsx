// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-96 rounded-xl border border-dashed border-border p-4">
      <NativeSelect fullWidth defaultValue="weekly">
        <Label>Digest</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="daily">Daily</NativeSelect.Option>
          <NativeSelect.Option value="weekly">Weekly</NativeSelect.Option>
          <NativeSelect.Option value="never">Never</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullWidth />
    </div>
  );
}
