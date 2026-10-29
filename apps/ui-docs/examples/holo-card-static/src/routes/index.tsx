// Rivet-authored HoloCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { HoloCard } from "@rivetjs/ui/holo-card";

export const head = { title: "HoloCard: Static" };

// #region demo
export function Static() {
  return (
    <HoloCard id="hc-static" isInteractive={false}>
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
      <Static />
    </div>
  );
}
