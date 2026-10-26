import { Pause, Play } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

/** Hero backdrop: static markup; the aurora canvas and its pause button come alive in `hero.ts` (no resume runtime). */
export function HomeCanvas() {
  return (
    <div class="hs-backdrop">
      <div class="hs-aurora" aria-hidden="true">
        <canvas width="8" height="8" />
      </div>
      <button type="button" class="hs-ambient-control" aria-label="Pause background animation" aria-pressed="false">
        <span class="hs-ambient-pause">
          <Icon icon={Pause} size={13} />
        </span>
        <span class="hs-ambient-play">
          <Icon icon={Play} size={13} />
        </span>
        <span>Ambient motion</span>
      </button>
    </div>
  );
}
