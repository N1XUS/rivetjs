import { signal } from "@rivetjs/reactivity";
import { CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { Check, Minus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Indeterminate Checkbox" };

// #region demo
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-white transition " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 " +
  "group-data-[indeterminate]:border-teal-700 group-data-[indeterminate]:bg-teal-700";

export default function SelectAll() {
  const apples = signal(true);
  const pears = signal(false);
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <CheckboxField
        id="all"
        // Accessors stay live: checked while both are, "mixed" while only one is.
        isSelected={() => apples() && pears()}
        isIndeterminate={() => apples() !== pears()}
        onChange={(isSelected) => {
          apples.set(isSelected);
          pears.set(isSelected);
        }}
      >
        <CheckboxButton class={button}>
          {/* Render props are accessors: read them inside the content. */}
          {({ isSelected, isIndeterminate }) => (
            <>
              <span class={box} aria-hidden="true">
                {isIndeterminate() ? (
                  <Icon icon={Minus} size={14} strokeWidth={3} class="dash" />
                ) : isSelected() ? (
                  <Icon icon={Check} size={14} strokeWidth={3} class="check" />
                ) : null}
              </span>
              All fruit
            </>
          )}
        </CheckboxButton>
      </CheckboxField>
      <div class="ml-7 grid gap-2">
        <CheckboxField id="apples" isSelected={apples}>
          <CheckboxButton class={button}>
            <span class={box} aria-hidden="true">
              <Icon icon={Check} size={14} strokeWidth={3} />
            </span>
            Apples
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField id="pears" isSelected={pears}>
          <CheckboxButton class={button}>
            <span class={box} aria-hidden="true">
              <Icon icon={Check} size={14} strokeWidth={3} />
            </span>
            Pears
          </CheckboxButton>
        </CheckboxField>
      </div>
    </section>
  );
}
// #endregion
