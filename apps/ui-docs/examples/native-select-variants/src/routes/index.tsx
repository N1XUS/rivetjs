// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <NativeSelect class="w-48" defaultValue="asc">
        <Label>Primary</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="asc">Oldest first</NativeSelect.Option>
          <NativeSelect.Option value="desc">Newest first</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
      <NativeSelect class="w-48" defaultValue="desc" variant="secondary">
        <Label>Secondary</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="asc">Oldest first</NativeSelect.Option>
          <NativeSelect.Option value="desc">Newest first</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
