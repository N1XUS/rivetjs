// Homepage headline with a rotating last word. CSS only: the server renders every word stacked in one grid cell
// (slot width = widest word, no layout shift); `home.css` cycles them with one shared keyframe offset per word, runs
// two cycles and stops on the last word. No JS of its own: pause is a visually hidden checkbox
// (`.rw-head:has(.rw-pause input:checked)`), hover / focus also pause, reduced motion shows the first word and the
// full list as text. Known: the derived loader holds the first click on the checkbox (inside the router Root's range)
// and replays its toggle once the runtime started (tests/home.test.ts "pause control"). The accessible name is the full sentence (`label`); the animated words are aria-hidden.
import { Pause, Play } from "lucide";
import { Icon } from "@rivetjs/kit/icon";

export interface RotatingWordsProps {
  /** Text before the rotating word ("The JSX framework built to be"). */
  lead: string;
  /** Rotating words, shown in order; the animation stops on the last one. */
  words: readonly string[];
  /** Full sentence for assistive technology and no-CSS rendering. */
  label: string;
  /** Time per word in ms (default 2600). */
  period?: number;
  /** Heading id (for `aria-labelledby`). */
  id?: string;
}

export function RotatingWords(props: RotatingWordsProps) {
  return (
    <div class="rw-head" style={{ "--rw-period": `${props.period ?? 2600}ms`, "--rw-count": String(props.words.length) }}>
      <h1 id={props.id} class="rw-title">
        <span class="sr-only">{props.label}</span>
        <span class="rw-visual" aria-hidden="true">
          <span class="rw-lead">{props.lead}</span>{" "}
          <span class="rw">
            {props.words.map((word, index) => (
              <span class="rw-word" style={{ "--i": String(index) }} data-last={index === props.words.length - 1 ? "" : undefined}>
                {word}
              </span>
            ))}
          </span>
        </span>
      </h1>
      <label class="rw-pause">
        <input type="checkbox" class="sr-only" aria-label="Pause headline animation" />
        <Icon icon={Pause} size={16} class="rw-pause-icon" />
        <Icon icon={Play} size={16} class="rw-play-icon" />
      </label>
      <p class="rw-list" aria-hidden="true">
        {props.words.map((word) => word.replace(/\.$/, "")).join(" · ")}
      </p>
    </div>
  );
}
