// Rivet-authored NativeSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Invalid State" };

// #region demo
export function Invalid() {
  return (
    <NativeSelect class="w-64" defaultValue="free" isInvalid>
      <Label>Plan</Label>
      <NativeSelect.Trigger>
        <NativeSelect.Option value="free">Free</NativeSelect.Option>
        <NativeSelect.Option value="team">Team</NativeSelect.Option>
      </NativeSelect.Trigger>
      <Description>Billed monthly</Description>
      <FieldError>The free plan allows one workspace</FieldError>
    </NativeSelect>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Invalid />
    </div>
  );
}
