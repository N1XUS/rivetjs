import { Button } from "@rivetjs/cdk/button";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { NumberField } from "@rivetjs/cdk/number-field";
import { Minus, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "NumberField formats: currency, percent, units" };

const field = "grid gap-1";
const group = "flex h-9 overflow-hidden rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500";
const input = "w-full min-w-0 px-2 outline-none";
const stepper = "flex w-8 items-center justify-center border-l border-slate-300 text-slate-600 hover:bg-slate-100 disabled:text-slate-300";

// #region demo
export default function Formats() {
  return (
    <form class="m-4 grid w-56 gap-3 text-sm">
      <NumberField id="price" name="price" defaultValue={25} minValue={0} formatOptions={{ style: "currency", currency: "USD" }} class={field}>
        <Label>Price</Label>
        <Group class={group}>
          <Input class={input} />
          <Button slot="decrement" class={stepper}>
            <Icon icon={Minus} />
          </Button>
          <Button slot="increment" class={stepper}>
            <Icon icon={Plus} />
          </Button>
        </Group>
      </NumberField>
      <NumberField id="discount" defaultValue={0.15} minValue={0} maxValue={1} step={0.05} formatOptions={{ style: "percent" }} class={field}>
        <Label>Discount</Label>
        <Group class={group}>
          <Input class={input} />
          <Button slot="decrement" class={stepper}>
            <Icon icon={Minus} />
          </Button>
          <Button slot="increment" class={stepper}>
            <Icon icon={Plus} />
          </Button>
        </Group>
      </NumberField>
      <NumberField id="length" defaultValue={12} step={0.5} formatOptions={{ style: "unit", unit: "centimeter" }} class={field}>
        <Label>Length</Label>
        <Group class={group}>
          <Input class={input} />
        </Group>
      </NumberField>
    </form>
  );
}
// #endregion
