import { signal } from "@rivetjs/reactivity";
import { CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Checkbox events" };

// #region demo
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500";

export default function CheckboxEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      {/* Change, press, focus and key events are CheckboxField props; focus and keys fire on the <input>. */}
      <CheckboxField
        id="cb-ev"
        onChange={(isSelected) => add("change:" + isSelected)}
        onPress={(event) => add("press:" + event.pointerType)}
        onFocus={() => add("focus")}
        onBlur={() => add("blur")}
        onFocusChange={(isFocused) => add("focus:" + isFocused)}
        onKeyDown={(event) => add("keydown:" + event.key)}
        onKeyUp={(event) => add("keyup:" + event.key)}
      >
        {/* Hover events belong to the clickable part. */}
        <CheckboxButton class={button} onHoverStart={() => add("hover")}>
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          Remember me
        </CheckboxButton>
      </CheckboxField>
      <output id="cb-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
