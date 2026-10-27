// Rivet-authored HoloCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { HoloCard } from "@rivetjs/ui/holo-card";

export const head = { title: "HoloCard: Custom Gradient" };

// #region demo
export function CustomGradient() {
  return (
    <HoloCard gradient="linear-gradient(140deg, #01eef9 0%, #0360fa 35%, #5b00f8 70%, #f827f5 100%)">
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface>
            <HoloCard.Inset />
            <HoloCard.Pattern />
            <HoloCard.Content class="flex-col items-center justify-center gap-1">
              <span class="text-xs font-medium tracking-[0.3em] text-white/60 uppercase">Member</span>
              <span class="text-3xl font-bold text-white">Ada Byron</span>
            </HoloCard.Content>
            <HoloCard.Content class="items-end justify-center pb-10">
              <span class="text-sm text-white/40 tabular-nums">No. 0815</span>
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
      <CustomGradient />
    </div>
  );
}
