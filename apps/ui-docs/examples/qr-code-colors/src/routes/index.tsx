// Rivet-authored QRCode demo (Rivet addition, own demo content).
import { QRCode } from "@rivetjs/ui/qr-code";

export const head = { title: "QRCode: Colors" };

const menu = "https://bistro.example.com/menu";

// #region demo
export function Colors() {
  return (
    <div class="flex flex-wrap items-center justify-center gap-4">
      <QRCode value={menu} size="sm" aria-label="Menu (default)" />
      <QRCode id="color-accent" value={menu} size="sm" color="accent" aria-label="Menu (accent)" />
      <QRCode id="color-brand" value={menu} size="sm" shape="dots" color="brand" aria-label="Menu (brand)" />
      <QRCode id="color-sunset" value={menu} size="sm" shape="dots" color="sunset" aria-label="Menu (sunset)" />
      <QRCode value={menu} size="sm" shape="rounded" class="[--qr-code-fg:var(--success)]" aria-label="Menu (custom)" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Colors />
    </div>
  );
}
