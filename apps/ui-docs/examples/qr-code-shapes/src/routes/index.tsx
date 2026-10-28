// Rivet-authored QRCode demo (Rivet addition, own demo content).
import { QRCode } from "@rivetjs/ui/qr-code";

export const head = { title: "QRCode: Shapes" };

const ticket = "https://tickets.example.com/e/rivet-meetup-kyiv/7Q4K2";

// #region demo
export function Shapes() {
  return (
    <div class="flex flex-wrap items-start justify-center gap-6 text-sm">
      <figure class="flex flex-col items-center gap-2">
        <QRCode id="shape-square" value={ticket} shape="square" aria-label="Meetup ticket" />
        <figcaption class="text-muted">square</figcaption>
      </figure>
      <figure class="flex flex-col items-center gap-2">
        <QRCode id="shape-dots" value={ticket} shape="dots" aria-label="Meetup ticket" />
        <figcaption class="text-muted">dots</figcaption>
      </figure>
      <figure class="flex flex-col items-center gap-2">
        <QRCode id="shape-rounded" value={ticket} shape="rounded" aria-label="Meetup ticket" />
        <figcaption class="text-muted">rounded</figcaption>
      </figure>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shapes />
    </div>
  );
}
