// Rivet addition (no HeroUI counterpart): a Motion element with the ui button classes, gestures from @rivetjs/motion.
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Save } from "lucide";
import { Motion, spring } from "@rivetjs/motion";
import { buttonVariants } from "@rivetjs/ui/button";

export const head = { title: "Motion: Button press" };

// #region demo
export function ButtonPress() {
  const saves = signal(0);
  return (
    <div class="flex items-center gap-4">
      <Motion.button
        id="save"
        type="button"
        class={buttonVariants()}
        whileHover={{ scale: 1.05 }}
        whilePress={{ scale: 0.92 }}
        transition={{ type: spring, visualDuration: 0.25, bounce: 0.4 }}
        onPress={() => saves.update((n) => n + 1)}
      >
        <Icon icon={Save} class="size-4" />
        Save
      </Motion.button>
      <span class="text-sm text-muted">
        Saved <span id="saves">{saves()}</span> times
      </span>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ButtonPress />
    </div>
  );
}
