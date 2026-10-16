import { signal } from "@rivetjs/reactivity";
import { clamp, roundToStepPrecision, snapValueToStep, toFixedNumber } from "@rivetjs/cdk/utils";

export const head = { title: "Number helpers" };

// #region demo
export default function Numbers() {
  const raw = signal("7.3");
  const value = () => Number(raw()) || 0;
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <label class="grid gap-1">
        Value (min 0, max 10, step 0.5)
        <input
          id="value"
          type="text"
          inputMode="decimal"
          class="rounded border border-slate-300 px-2 py-1 font-mono"
          value={raw()}
          onInput={(event) => raw.set(event.currentTarget.value)}
        />
      </label>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 font-mono text-xs">
        <dt>clamp(value, 0, 10)</dt>
        <dd id="clamp">{clamp(value(), 0, 10)}</dd>
        <dt>snapValueToStep(value, 0, 10, 0.5)</dt>
        <dd id="snap">{snapValueToStep(value(), 0, 10, 0.5)}</dd>
        <dt>snapValueToStep(value, 1, 10, 3)</dt>
        <dd id="snap3">{snapValueToStep(value(), 1, 10, 3)}</dd>
        <dt>roundToStepPrecision(value, 0.01)</dt>
        <dd id="round">{roundToStepPrecision(value(), 0.01)}</dd>
        <dt>toFixedNumber(value, 1)</dt>
        <dd id="fixed">{toFixedNumber(value(), 1)}</dd>
      </dl>
    </section>
  );
}
// #endregion
