// Rivet-authored QRCode demo (Rivet addition, own demo content).
import { QRCode } from "@rivetjs/ui/qr-code";

export const head = { title: "QRCode: Sizes" };

const profile = "https://rivetjs.severyn.pro";

// #region demo
export function Sizes() {
  return (
    <div class="flex flex-wrap items-end justify-center gap-6">
      <QRCode id="size-px" value={profile} size={72} aria-label="Docs (72 px)" />
      <QRCode id="size-sm" value={profile} size="sm" aria-label="Docs (small)" />
      <QRCode value={profile} size="md" aria-label="Docs (medium)" />
      <QRCode id="size-lg" value={profile} size="lg" aria-label="Docs (large)" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
