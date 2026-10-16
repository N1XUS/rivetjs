// Rivet-authored NativeSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: With Disabled Options" };

// #region demo
export function DisabledOptions() {
  return (
    <NativeSelect class="w-64" defaultValue="s3">
      <Label>Seat</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="s1" disabled>
          1A (taken)
        </NativeSelect.Option>
        <NativeSelect.Option value="s2" disabled>
          1B (taken)
        </NativeSelect.Option>
        <NativeSelect.Option value="s3">1C</NativeSelect.Option>
        <NativeSelect.Option value="s4">1D</NativeSelect.Option>
      </NativeSelect.Trigger>
    </NativeSelect>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DisabledOptions />
    </div>
  );
}
