import { Pause, Play } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

const FIRST = "alive.";
/** Hero headline: static markup; the word rotation and its pause button run in `hero.ts` (no resume runtime). */
export function HomeHeadline() {
  return (
    <div class="hs-headline">
      <h1 id="lp-title" aria-label="Make the web feel alive, fast and fluid.">
        <span>Make the web</span>
        <span class="hs-title-line" aria-hidden="true">
          feel{" "}
          <span class="hs-word-window">
            <span class="hs-word">
              {Array.from(FIRST).map((char) => (
                <span class="hs-word-letter">{char}</span>
              ))}
            </span>
          </span>
        </span>
      </h1>
      <button class="hs-word-pause" type="button" aria-label="Pause headline animation" aria-pressed="false">
        <span class="hs-word-pause-icon">
          <Icon icon={Pause} size={13} />
        </span>
        <span class="hs-word-play-icon">
          <Icon icon={Play} size={13} />
        </span>
      </button>
    </div>
  );
}
