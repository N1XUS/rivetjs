import { Pause, Play } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

/**
 * Hero backdrop, CSS only (STATIC-ZERO-3): four soft brand blobs (`.hs-blob`, radial gradients) drift and breathe on
 * composited `translate` / `scale` animations (`home-studio.css`, 23–40 s loops, phase per blob); the native checkbox
 * pauses them (`:has(:checked)`), reduced motion keeps the still frame, hidden tabs stop CSS animations. It was a 24 fps
 * canvas loop in `hero.ts`, the docs home's only script before input.
 */
export function HomeCanvas() {
  return (
    <div class="hs-backdrop">
      <div class="hs-aurora" aria-hidden="true">
        <span class="hs-blob" />
        <span class="hs-blob" />
        <span class="hs-blob" />
        <span class="hs-blob" />
      </div>
      <label class="hs-ambient-control hs-pause">
        <input type="checkbox" class="hs-pause-input" aria-label="Pause background animation" />
        <span class="hs-pause-icon">
          <Icon icon={Pause} size={13} />
        </span>
        <span class="hs-play-icon">
          <Icon icon={Play} size={13} />
        </span>
        <span>Ambient motion</span>
      </label>
    </div>
  );
}
