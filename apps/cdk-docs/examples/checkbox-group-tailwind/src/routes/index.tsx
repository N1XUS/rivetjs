import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "CheckboxGroup with Tailwind" };

// #region demo
// Each CheckboxButton (<label>) is a selectable card styled from its data-* state.
const card =
  "block cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-center transition " +
  "data-[hovered]:bg-slate-50 data-[pressed]:scale-95 " +
  "data-[selected]:border-teal-700 data-[selected]:bg-teal-50 data-[selected]:text-teal-900 " +
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-500 " +
  "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40";

export default function Platforms() {
  return (
    <CheckboxGroup id="tw-cg" defaultValue={["web"]} class="m-4 grid max-w-md grid-cols-3 gap-2 text-sm data-[invalid]:text-red-700">
      <Label class="col-span-3 font-medium">Platforms</Label>
      <CheckboxField value="web">
        <CheckboxButton class={card}>Web</CheckboxButton>
      </CheckboxField>
      <CheckboxField value="mobile">
        <CheckboxButton class={card}>Mobile</CheckboxButton>
      </CheckboxField>
      <CheckboxField value="tv" isDisabled>
        <CheckboxButton class={card}>TV</CheckboxButton>
      </CheckboxField>
      <Text slot="description" class="col-span-3 text-xs text-slate-500">
        Where the app ships.
      </Text>
    </CheckboxGroup>
  );
}
// #endregion
