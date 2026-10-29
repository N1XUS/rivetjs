// Rivet-authored HoloCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { HoloCard } from "@rivetjs/ui/holo-card";
import { Sparkles } from "lucide";

import portraitImage from "../assets/avatar-person-3.jpg?image";

export const head = { title: "HoloCard: Membership Card" };

// #region demo
export function MembershipCard() {
  return (
    <HoloCard
      id="hc-membership"
      gradient="linear-gradient(160deg, oklch(0.34 0.09 264) 0%, oklch(0.24 0.12 290) 55%, oklch(0.16 0.06 320) 100%)"
      style={{ "--holo-card-width": "280px", "--holo-card-height": "420px" }}
    >
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface>
            <HoloCard.Inset />
            <HoloCard.Pattern />
            <HoloCard.Content class="items-start justify-between p-6 text-white/80">
              <span class="text-sm font-semibold">Northwind Climbing Club</span>
              <Icon icon={Sparkles} size={20} />
            </HoloCard.Content>
            <HoloCard.Content class="flex-col items-center justify-center gap-3">
              <img
                alt="Portrait of Jonah Reyes"
                src={portraitImage.src}
                width={portraitImage.width}
                height={portraitImage.height}
                class="size-24 rounded-full object-cover ring-2 ring-white/30"
              />
              <div class="flex flex-col items-center gap-1">
                <span class="text-2xl font-bold text-white">Jonah Reyes</span>
                <span class="text-xs font-medium tracking-[0.3em] text-white/60 uppercase">Gold member</span>
              </div>
            </HoloCard.Content>
            <HoloCard.Content class="items-end justify-between p-6 text-xs text-white/60">
              <div class="flex flex-col gap-0.5">
                <span>Member no.</span>
                <span class="font-mono text-sm text-white tabular-nums">NW-2048-117</span>
              </div>
              <div class="flex flex-col items-end gap-0.5">
                <span>Valid through</span>
                <span class="font-mono text-sm text-white tabular-nums">03/2027</span>
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
      <MembershipCard />
    </div>
  );
}
