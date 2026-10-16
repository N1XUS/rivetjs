import { CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { Check, Minus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Checkbox with Tailwind" };

// #region demo
// CheckboxButton is the <label> and carries the state: `group` on it, `group-data-[…]:` on the drawn box.
const button =
  "group flex cursor-pointer items-center gap-2 text-sm data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 " + "data-[pressed]:[&>.box]:scale-90";
const box =
  "box grid size-5 place-items-center rounded border-2 border-slate-400 text-white transition " +
  "group-data-[hovered]:border-slate-600 " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 " +
  "group-data-[indeterminate]:border-teal-700 group-data-[indeterminate]:bg-teal-700 " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2 " +
  "group-data-[invalid]:border-red-600";

export default function TailwindCheckbox() {
  return (
    <div class="m-4 grid gap-3">
      <CheckboxField id="tw-cb">
        <CheckboxButton class={button}>
          {({ isSelected }) => (
            <>
              <span class={box} aria-hidden="true">
                {isSelected() ? <Icon icon={Check} size={14} strokeWidth={3} class="check" /> : null}
              </span>
              Enable sync
            </>
          )}
        </CheckboxButton>
      </CheckboxField>
      <CheckboxField id="tw-mixed" isIndeterminate>
        <CheckboxButton class={button}>
          <span class={box} aria-hidden="true">
            <Icon icon={Minus} size={14} strokeWidth={3} />
          </span>
          Some folders
        </CheckboxButton>
      </CheckboxField>
      <CheckboxField id="tw-off" isDisabled defaultSelected>
        <CheckboxButton class={button}>
          <span class={box} aria-hidden="true">
            <Icon icon={Check} size={14} strokeWidth={3} />
          </span>
          Disabled
        </CheckboxButton>
      </CheckboxField>
    </div>
  );
}
// #endregion
