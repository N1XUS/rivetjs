// Rivet-authored QRCode demo (Rivet addition, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { QRCode } from "@rivetjs/ui/qr-code";

export const head = { title: "QRCode: Loading" };

// #region demo
export function Loading() {
  const invite = signal("");
  const loading = signal(true);
  const generate = () => {
    loading.set(true);
    // Stand-in for a request that mints the invite link.
    setTimeout(() => {
      invite.set(`https://app.example.com/join/${Math.random().toString(36).slice(2, 10)}`);
      loading.set(false);
    }, 900);
  };
  return (
    <div class="flex flex-col items-center gap-4">
      <QRCode id="invite-qr" value={invite()} isLoading={loading()} aria-label="Team invite link" />
      <Button id="invite-generate" variant="secondary" onPress={generate}>
        Generate invite
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Loading />
    </div>
  );
}
