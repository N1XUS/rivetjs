// Rivet-authored HoloCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { HoloCard } from "@rivetjs/ui/holo-card";

export const head = { title: "HoloCard: With Pattern" };

// #region demo
export function WithPattern() {
  return (
    <HoloCard
      style={{
        "--holo-card-pattern": "repeating-radial-gradient(circle at 30% 30%, #f9a8d4 0 6px, #a5b4fc 6px 12px, #67e8f9 12px 18px)",
        "--holo-card-pattern-size": "auto",
        "--holo-card-texture-opacity": "0.18",
      }}
    >
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
      <WithPattern />
    </div>
  );
}
