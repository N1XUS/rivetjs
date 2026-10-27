import { Pause, Play } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

const WORDS = ["alive.", "fast.", "fluid."];
/**
 * Hero headline, CSS only (STATIC-ZERO-3): every word is server markup stacked in one grid cell (`.hs-word-window`: the
 * slot is as wide as the widest word, no layout shift) and `home-studio.css` cycles them with one keyframe set: word `--w`
 * and letter `--j` offset its delay (staggered blur exit / entry, 3.1 s per word, forever). Each letter clips its own
 * slice of the word gradient (`--j` of `--n`), so the gradient runs on across the letters without measuring them. The
 * pause control is a native checkbox (`:has(:checked)` pauses the letters); reduced motion and print show the first word.
 * No JS: it was the docs home's only script before input (`hero.ts`, WAAPI + measured gradient offsets).
 */
export function HomeHeadline() {
  return (
    <div class="hs-headline">
      <h1 id="lp-title" aria-label="Make the web feel alive, fast and fluid.">
        <span>Make the web</span>
        <span class="hs-title-line" aria-hidden="true">
          feel{" "}
          <span class="hs-word-window">
            {WORDS.map((word, w) => (
              <span class="hs-word" style={{ "--w": String(w), "--n": String(word.length) }}>
                {Array.from(word).map((char, j) => (
                  <span class="hs-word-letter" style={{ "--j": String(j) }}>
                    {char}
                  </span>
                ))}
              </span>
            ))}
          </span>
        </span>
      </h1>
      <label class="hs-word-pause hs-pause">
        <input type="checkbox" class="hs-pause-input" aria-label="Pause headline animation" />
        <span class="hs-pause-icon">
          <Icon icon={Pause} size={13} />
        </span>
        <span class="hs-play-icon">
          <Icon icon={Play} size={13} />
        </span>
      </label>
    </div>
  );
}
