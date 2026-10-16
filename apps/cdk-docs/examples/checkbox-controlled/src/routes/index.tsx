import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Controlled and uncontrolled Checkbox" };

// #region demo
// CheckboxButton is the <label>; its data-* state drives the drawn box (the native input is visually hidden).
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent transition " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2";

export default function Subscriptions() {
  const news = signal(false);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      {/* Controlled: the signal and the box stay in step both ways. */}
      <CheckboxField id="news" isSelected={news}>
        <CheckboxButton class={button}>
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          <span>
            Send me the <strong>newsletter</strong>
          </span>
        </CheckboxButton>
      </CheckboxField>
      {/* Uncontrolled: starts checked. */}
      <CheckboxField id="tips" defaultSelected>
        <CheckboxButton class={button}>
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          Show tips
        </CheckboxButton>
      </CheckboxField>
      <Button id="clear" onPress={() => news.set(false)}>
        Unsubscribe
      </Button>
      <p id="cb-state">Newsletter: {news() ? "yes" : "no"}</p>
    </section>
  );
}
// #endregion
