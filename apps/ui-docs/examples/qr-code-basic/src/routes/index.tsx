// Rivet-authored QRCode demo (Rivet addition, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { QRCode } from "@rivetjs/ui/qr-code";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "QRCode: Basic" };

// #region demo
export function Basic() {
  const link = signal("https://rivetjs.severyn.pro");
  return (
    <div class="flex flex-col items-center gap-5">
      <QRCode id="share-qr" value={link()} />
      <TextField id="share-link" class="w-72" value={link}>
        <Label>Link</Label>
        <Input />
      </TextField>
    </div>
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
