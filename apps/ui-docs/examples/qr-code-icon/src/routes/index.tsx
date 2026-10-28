// Rivet-authored QRCode demo (Rivet addition, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { QRCode } from "@rivetjs/ui/qr-code";
import { Wifi, Wallet } from "lucide";

export const head = { title: "QRCode: Icon" };

// #region demo
export function WithIcon() {
  return (
    <div class="flex flex-wrap items-center justify-center gap-6">
      <QRCode id="wifi-qr" value="WIFI:T:WPA;S:Studio Guest;P:paper-lantern-42;;" shape="rounded" aria-label="Guest Wi-Fi">
        <Icon icon={Wifi} />
      </QRCode>
      <QRCode id="pay-qr" value="https://pay.example.com/i/INV-2026-0418" shape="dots" color="accent" iconSize={0.26} aria-label="Pay invoice INV-2026-0418">
        <Icon icon={Wallet} />
      </QRCode>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIcon />
    </div>
  );
}
