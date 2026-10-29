// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: With Label" };

// #region demo
export function WithLabel() {
  return (
    <div class="flex flex-col gap-4">
      <NativeSelect class="w-64" defaultValue="metric">
        <Label>Units</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="metric">Metric</NativeSelect.Option>
          <NativeSelect.Option value="imperial">Imperial</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
      <NativeSelect class="w-64" aria-label="Rows per page" defaultValue="25">
        <NativeSelect.Trigger>
          <NativeSelect.Option value="10">10 rows</NativeSelect.Option>
          <NativeSelect.Option value="25">25 rows</NativeSelect.Option>
          <NativeSelect.Option value="50">50 rows</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithLabel />
    </div>
  );
}
