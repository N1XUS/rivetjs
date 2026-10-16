// Rivet-authored NativeSelect demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Controlled" };

// #region demo
export function Controlled() {
  const zone = signal("utc");
  return (
    <div class="flex w-64 flex-col gap-3">
      <NativeSelect value={zone}>
        <Label>Time zone</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="utc">UTC</NativeSelect.Option>
          <NativeSelect.Option value="cet">Central European</NativeSelect.Option>
          <NativeSelect.Option value="est">US Eastern</NativeSelect.Option>
          <NativeSelect.Option value="jst">Japan</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
      <p class="text-sm text-muted">
        Value: <span id="zone">{zone()}</span>
      </p>
      <Button size="sm" variant="secondary" onPress={() => zone.set("jst")}>
        Switch to Japan
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
