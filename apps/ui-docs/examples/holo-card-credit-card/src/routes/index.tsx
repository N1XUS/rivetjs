// Rivet-authored HoloCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { HoloCard } from "@rivetjs/ui/holo-card";
import { Nfc } from "lucide";

export const head = { title: "HoloCard: Credit Card" };

// #region demo
export function CreditCard() {
  return (
    <HoloCard style={{ "--holo-card-width": "340px", "--holo-card-height": "214px", "--holo-card-radius": "16px" }}>
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface>
            <HoloCard.Inset />
            <HoloCard.Pattern />
            <HoloCard.Content class="flex-col justify-between p-6">
              <div class="flex items-center justify-between text-white/80">
                <span class="text-sm font-semibold">Rivet Bank</span>
                <Icon icon={Nfc} size={20} />
              </div>
              <div class="flex flex-col gap-1">
                <span class="font-mono text-lg tracking-widest text-white tabular-nums">4242 4242 4242 4242</span>
                <span class="text-xs text-white/50">ADA BYRON · 12/29</span>
              </div>
            </HoloCard.Content>
            <HoloCard.Shine />
          </HoloCard.Surface>
        </HoloCard.Frame>
      </HoloCard.Rotator>
    </HoloCard>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CreditCard />
    </div>
  );
}
