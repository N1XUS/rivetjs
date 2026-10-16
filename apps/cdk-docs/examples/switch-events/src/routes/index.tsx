import { signal } from "@rivetjs/reactivity";
import { Switch } from "@rivetjs/cdk/switch";

export const head = { title: "Switch events" };

// #region demo
const button = "group flex cursor-pointer items-center gap-3";
const track =
  "relative h-6 w-11 rounded-full bg-slate-300 transition group-data-[selected]:bg-teal-700 " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2 " +
  "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition " +
  "group-data-[selected]:after:translate-x-5";

export default function SwitchEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      {/* Focus and key events fire on the <input>; press and hover events on the <label>. */}
      <Switch
        id="sw-ev"
        class={button}
        onChange={(isSelected) => add("change:" + isSelected)}
        onPress={(event) => add("press:" + event.pointerType)}
        onHoverStart={() => add("hover")}
        onFocus={() => add("focus")}
        onBlur={() => add("blur")}
        onFocusChange={(isFocused) => add("focus:" + isFocused)}
        onKeyDown={(event) => add("keydown:" + event.key)}
        onKeyUp={(event) => add("keyup:" + event.key)}
      >
        <span class={track} aria-hidden="true" />
        Notifications
      </Switch>
      <output id="sw-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
