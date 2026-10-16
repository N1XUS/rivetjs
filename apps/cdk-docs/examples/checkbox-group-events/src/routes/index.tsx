import { signal } from "@rivetjs/reactivity";
import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "CheckboxGroup events" };

// #region demo
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500";

export default function Channels() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((entries) => [...entries, entry]);
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      {/* Group: onChange with the checked values; focus events while focus is anywhere inside. */}
      <CheckboxGroup
        id="channels"
        class="grid gap-2"
        onChange={(values) => add(`group:[${values.join(",")}]`)}
        onFocusChange={(isFocused) => add("group:focus:" + isFocused)}
      >
        <Label>Notify me by</Label>
        {/* Checkbox: its own change, focus and key events (on its <input>). */}
        <CheckboxField value="email" onChange={(isSelected) => add("email:" + isSelected)} onFocusChange={(isFocused) => add("email:focus:" + isFocused)}>
          <CheckboxButton class={button}>
            <span class={box} aria-hidden="true">
              <Icon icon={Check} size={14} strokeWidth={3} />
            </span>
            Email
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="sms" onKeyDown={(event) => add("sms:keydown:" + event.key)}>
          <CheckboxButton class={button}>
            <span class={box} aria-hidden="true">
              <Icon icon={Check} size={14} strokeWidth={3} />
            </span>
            SMS
          </CheckboxButton>
        </CheckboxField>
      </CheckboxGroup>
      <output id="cg-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
