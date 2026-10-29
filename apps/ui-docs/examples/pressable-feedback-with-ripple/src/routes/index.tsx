// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { Pause, Play, SkipBack, SkipForward } from "lucide";

export const head = { title: "PressableFeedback: With Ripple" };

// #region demo
export function WithRipple() {
  const playing = signal(false);
  const track = signal(1);
  const control = "flex size-12 items-center justify-center rounded-full text-foreground";
  return (
    <div class="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-4 shadow-surface">
      <span id="pf-with-ripple-track" class="text-sm text-muted">
        Track {track()} of 12
      </span>
      <div class="flex items-center gap-2">
        <PressableFeedback id="pf-ripple-prev" aria-label="Previous track" class={control} onPress={() => track.set(Math.max(1, track() - 1))}>
          <PressableFeedback.Ripple />
          <Icon icon={SkipBack} size={20} />
        </PressableFeedback>
        <PressableFeedback
          id="pf-ripple-play"
          aria-label={playing() ? "Pause" : "Play"}
          class="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground"
          onPress={() => playing.set(!playing())}
        >
          <PressableFeedback.Ripple pressedOpacity={0.24} />
          <Show when={playing()} fallback={<Icon icon={Play} size={22} />}>
            {() => <Icon icon={Pause} size={22} />}
          </Show>
        </PressableFeedback>
        <PressableFeedback id="pf-ripple-next" aria-label="Next track" class={control} onPress={() => track.set(Math.min(12, track() + 1))}>
          <PressableFeedback.Ripple />
          <Icon icon={SkipForward} size={20} />
        </PressableFeedback>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithRipple />
    </div>
  );
}
