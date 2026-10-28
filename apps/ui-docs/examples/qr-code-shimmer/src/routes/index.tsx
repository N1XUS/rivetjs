// Rivet-authored QRCode demo (Rivet addition, own demo content).
import { QRCode } from "@rivetjs/ui/qr-code";

export const head = { title: "QRCode: Shimmer" };

// #region demo
export function Shimmer() {
  return <QRCode id="promo-qr" value="https://shop.example.com/drop/spring" shape="rounded" color="brand" size="lg" shimmer aria-label="Spring drop" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shimmer />
    </div>
  );
}
