// Rivet-authored CellSwitch demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { CellSwitch } from "@rivetjs/ui/cell-switch";

export const head = { title: "CellSwitch: Settings Group" };

// #region demo
export function SettingsGroup() {
  return (
    <section id="cs-settings" aria-labelledby="cs-settings-title" class="flex w-full max-w-sm flex-col gap-2">
      <h3 id="cs-settings-title" class="px-1 text-sm font-medium text-muted">
        Privacy
      </h3>
      <div class="flex flex-col gap-2">
        <CellSwitch defaultSelected label="Share usage data" description="Helps us fix crashes faster" />
        <CellSwitch label="Personalised ads" description="Based on your activity in the app" />
        <CellSwitch defaultSelected label="Read receipts" description="Others see when you read their messages" />
      </div>
    </section>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <SettingsGroup />
    </div>
  );
}
