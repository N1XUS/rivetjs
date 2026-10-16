import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { NumberField } from "@rivetjs/cdk/number-field";
import { Text } from "@rivetjs/cdk/text";
import { Minus, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "NumberField with stepper buttons" };

const stepper = "flex w-8 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:text-slate-300";

// #region demo
export default function WidthField() {
  const width = signal<number | null>(1024);
  return (
    <div id="width-field" class="m-4 w-56 text-sm">
      <NumberField id="width" value={width} minValue={0} class="grid gap-1">
        <Label class="font-medium">Width</Label>
        <Group class="flex h-9 overflow-hidden rounded-md border border-slate-300 focus-within:ring-2 focus-within:ring-teal-500">
          <Button slot="decrement" class={stepper}>
            <Icon icon={Minus} />
          </Button>
          <Input class="w-full min-w-0 border-x border-slate-300 px-2 text-center outline-none" />
          <Button slot="increment" class={stepper}>
            <Icon icon={Plus} />
          </Button>
        </Group>
        <Text slot="description" class="text-xs text-slate-500">
          Pixels
        </Text>
      </NumberField>
      <p class="mt-3 text-slate-500">
        Signal value: <span id="width-value">{String(width())}</span>
      </p>
    </div>
  );
}
// #endregion
