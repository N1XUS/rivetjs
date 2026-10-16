import { signal, type Signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { controllable } from "@rivetjs/cdk/interactions";
import { updateEffect } from "@rivetjs/cdk/utils";
import { Minus, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "controllable()" };

// #region demo
interface StepperProps {
  id: string;
  /** Controlled: the caller's signal (two-way). */
  value?: Signal<number>;
  /** Uncontrolled: the starting value of an internal signal. */
  defaultValue?: number;
}

function Stepper(props: StepperProps) {
  const value = controllable(props.value, props.defaultValue ?? 0);
  return (
    <div class="flex items-center gap-2">
      <button
        id={`${props.id}-minus`}
        type="button"
        aria-label="Decrease"
        class="rounded border border-slate-300 px-2"
        onClick={() => value.update((n) => n - 1)}
      >
        <Icon icon={Minus} />
      </button>
      <output id={props.id} class="w-8 text-center font-mono">
        {value()}
      </output>
      <button
        id={`${props.id}-plus`}
        type="button"
        aria-label="Increase"
        class="rounded border border-slate-300 px-2"
        onClick={() => value.update((n) => n + 1)}
      >
        <Icon icon={Plus} />
      </button>
    </div>
  );
}

export default function Steppers() {
  const quantity = signal(2);
  const changes = signal(0);
  // updateEffect skips the first run: count changes only.
  clientEffect(() =>
    updateEffect(
      () => [quantity()],
      () => void changes.update((n) => n + 1),
    ),
  );
  return (
    <section class="m-4 grid max-w-sm gap-2 text-sm">
      <p>Uncontrolled (defaultValue 5):</p>
      <Stepper id="free" defaultValue={5} />
      <p>Controlled (the page owns the signal):</p>
      <Stepper id="owned" value={quantity} />
      <p id="parent">
        Page sees quantity = {quantity()}, changed {changes()} times
      </p>
      <button id="clear" type="button" class="justify-self-start rounded-md border border-slate-300 px-3 py-1" onClick={() => quantity.set(0)}>
        Set to 0 from the page
      </button>
    </section>
  );
}
// #endregion
