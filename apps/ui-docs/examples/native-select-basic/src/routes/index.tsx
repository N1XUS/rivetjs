// Rivet-authored NativeSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Usage" };

// #region demo
export function Basic() {
  return (
    <NativeSelect class="w-64" defaultValue="oolong">
      <Label>Tea</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="green">Green</NativeSelect.Option>
        <NativeSelect.Option value="oolong">Oolong</NativeSelect.Option>
        <NativeSelect.Option value="black">Black</NativeSelect.Option>
        <NativeSelect.Option value="white">White</NativeSelect.Option>
      </NativeSelect.Trigger>
    </NativeSelect>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
