import { signal } from "@rivetjs/reactivity";
import { CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Disabled, read-only and invalid Checkbox" };

// #region demo
const button = "group flex cursor-pointer items-center gap-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[readonly]:border-dashed group-data-[invalid]:border-red-600";

export default function States() {
  const confirmed = signal(false);
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <CheckboxField id="cb-off" isDisabled>
        <CheckboxButton class={button}>
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          Disabled
        </CheckboxButton>
      </CheckboxField>
      <CheckboxField id="cb-ro" defaultSelected isReadOnly>
        <CheckboxButton class={button}>
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          Read-only (stays checked)
        </CheckboxButton>
      </CheckboxField>
      {/* isInvalid as an accessor: invalid until checked. */}
      <CheckboxField id="cb-bad" isSelected={confirmed} isInvalid={() => !confirmed()}>
        <CheckboxButton class={button}>
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          Confirm (invalid until checked)
        </CheckboxButton>
      </CheckboxField>
    </section>
  );
}
// #endregion
