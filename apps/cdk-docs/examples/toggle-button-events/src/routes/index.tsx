import { signal } from "@rivetjs/reactivity";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "ToggleButton events" };

// #region demo
export default function ToggleEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      <ToggleButton
        id="mute"
        onChange={(isSelected) => add("change:" + isSelected)}
        onPress={(event) => add("press:" + event.pointerType)}
        onPressStart={(event) => add("start:" + event.pointerType)}
        onPressEnd={(event) => add("end:" + event.pointerType)}
        onPressChange={(isPressed) => add("pressed:" + isPressed)}
        onFocus={() => add("focus")}
        onBlur={() => add("blur")}
        onFocusChange={(isFocused) => add("focus:" + isFocused)}
        onKeyDown={(event) => add("keydown:" + event.key)}
        onKeyUp={(event) => add("keyup:" + event.key)}
      >
        Mute
      </ToggleButton>
      <output id="tb-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
