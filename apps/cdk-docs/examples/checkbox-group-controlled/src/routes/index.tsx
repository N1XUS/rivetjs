import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Controlled and uncontrolled CheckboxGroup" };

// #region demo
const group = "grid gap-2 [&>.rv-Label]:font-medium [&>.rv-Text]:text-xs [&>.rv-Text]:text-slate-500";
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500";

/** The drawn box of each checkbox. */
function Box() {
  return (
    <span class={box} aria-hidden="true">
      <Icon icon={Check} size={14} strokeWidth={3} />
    </span>
  );
}

export default function Pizza() {
  const picked = signal<string[]>(["cheese"]);
  return (
    <section class="m-4 grid max-w-md gap-4 text-sm">
      {/* Controlled: the signal holds the checked values (two-way). */}
      <CheckboxGroup id="toppings" name="toppings" value={picked} class={group}>
        <Label>Toppings</Label>
        <CheckboxField value="cheese">
          <CheckboxButton class={button}>
            <Box />
            Cheese
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="ham">
          <CheckboxButton class={button}>
            <Box />
            Ham
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="olives">
          <CheckboxButton class={button}>
            <Box />
            Olives
          </CheckboxButton>
        </CheckboxField>
        <Text slot="description">Pick any.</Text>
      </CheckboxGroup>
      <div class="flex gap-2">
        <Button id="all" onPress={() => picked.set(["cheese", "ham", "olives"])}>
          All
        </Button>
        <Button id="none" onPress={() => picked.set([])}>
          None
        </Button>
      </div>
      <p id="picked">Picked: {picked().length ? picked().join(", ") : "nothing"}</p>
      {/* Uncontrolled: starts from defaultValue. */}
      <CheckboxGroup id="sides" defaultValue={["fries"]} class={group}>
        <Label>Sides</Label>
        <CheckboxField value="fries">
          <CheckboxButton class={button}>
            <Box />
            Fries
          </CheckboxButton>
        </CheckboxField>
        <CheckboxField value="salad">
          <CheckboxButton class={button}>
            <Box />
            Salad
          </CheckboxButton>
        </CheckboxField>
      </CheckboxGroup>
    </section>
  );
}
// #endregion
