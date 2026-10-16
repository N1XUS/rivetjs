import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "CheckboxGroup content" };

// #region demo
const card =
  "group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-x-2 rounded-lg border border-slate-300 px-3 py-2 " +
  "data-[selected]:border-teal-700 data-[selected]:bg-teal-50";

export default function AddOns() {
  return (
    <CheckboxGroup id="plans" class="m-4 grid max-w-sm gap-2 text-sm">
      {/* The group's render props: `state` holds the checked values. */}
      {({ state }) => (
        <>
          <Label>
            <strong>Add-ons</strong> <small>(monthly)</small>
          </Label>
          <CheckboxField value="pro">
            <CheckboxButton class={card}>
              {/* CheckboxButton render props (accessors) pick the content. */}
              {({ isSelected }) => (
                <>
                  <span class="grid size-5 place-items-center rounded-full border border-slate-400 text-teal-700" aria-hidden="true">
                    {isSelected() ? <Icon icon={Check} size={14} strokeWidth={3} class="check" /> : null}
                  </span>
                  <span>Pro support</span>
                  <span class="text-slate-500">$12</span>
                </>
              )}
            </CheckboxButton>
            <Text slot="description" class="ml-3 text-xs text-slate-500">
              Answers within a day.
            </Text>
          </CheckboxField>
          <CheckboxField value="backup">
            <CheckboxButton class={card}>
              {({ isSelected }) => (
                <>
                  <span class="grid size-5 place-items-center rounded-full border border-slate-400 text-teal-700" aria-hidden="true">
                    {isSelected() ? <Icon icon={Check} size={14} strokeWidth={3} class="check" /> : null}
                  </span>
                  <span>Backups</span>
                  <span class="text-slate-500">$4</span>
                </>
              )}
            </CheckboxButton>
          </CheckboxField>
          <p id="count" class="text-slate-600">
            {state.value().length} selected
          </p>
        </>
      )}
    </CheckboxGroup>
  );
}
// #endregion
