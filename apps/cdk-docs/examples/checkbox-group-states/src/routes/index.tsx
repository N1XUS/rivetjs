import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "CheckboxGroup options" };

// #region demo
const group = "grid gap-2 [&>.rv-Label]:font-medium data-[disabled]:opacity-50";
const button = "group flex cursor-pointer items-center gap-2 data-[disabled]:cursor-not-allowed data-[disabled]:text-slate-400";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[readonly]:border-dashed";

function Box() {
  return (
    <span class={box} aria-hidden="true">
      <Icon icon={Check} size={14} strokeWidth={3} />
    </span>
  );
}

export default function Options() {
  return (
    <section class="m-4 grid max-w-md gap-4 text-sm">
      {/* isDisabled on one checkbox. */}
      <CheckboxGroup id="days" class="flex flex-wrap gap-3 [&>.rv-Label]:w-full [&>.rv-Label]:font-medium">
        <Label>Days</Label>
        <CheckboxField value="mon">
          <CheckboxButton class={button}>
            <Box />
            Mon
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="tue">
          <CheckboxButton class={button}>
            <Box />
            Tue
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="sun" isDisabled>
          <CheckboxButton class={button}>
            <Box />
            Sun
          </CheckboxButton>
        </CheckboxField>
      </CheckboxGroup>
      {/* isDisabled on the group: every checkbox. */}
      <CheckboxGroup id="off" isDisabled defaultValue={["a"]} class={group}>
        <Label>Disabled group</Label>
        <CheckboxField value="a">
          <CheckboxButton class={button}>
            <Box />A
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="b">
          <CheckboxButton class={button}>
            <Box />B
          </CheckboxButton>
        </CheckboxField>
      </CheckboxGroup>
      {/* isReadOnly: focusable, the values do not change. */}
      <CheckboxGroup id="fixed" isReadOnly defaultValue={["a"]} class={group}>
        <Label>Read-only group</Label>
        <CheckboxField value="a">
          <CheckboxButton class={button}>
            <Box />A
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="b">
          <CheckboxButton class={button}>
            <Box />B
          </CheckboxButton>
        </CheckboxField>
      </CheckboxGroup>
    </section>
  );
}
// #endregion
