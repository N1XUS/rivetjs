import { signal } from "@rivetjs/reactivity";
import { Wheel, WheelPicker } from "@rivetjs/cdk/wheel-picker";

export const head = { title: "WheelPicker" };

const pad = (n: number) => String(n).padStart(2, "0");
const range = (count: number, unit: string) => Array.from({ length: count }, (_, i) => ({ value: i, label: `${pad(i)} ${unit}` }));
const HOURS = range(24, "h");
const MINUTES = range(60, "min");
const SECONDS = range(60, "s");

// #region demo
export default function Timer() {
  const hours = signal<number | null>(0);
  const minutes = signal<number | null>(5);
  const seconds = signal<number | null>(0);
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <WheelPicker id="timer" aria-label="Timer duration">
        <Wheel id="timer-hours" aria-label="Hours" options={HOURS} value={hours} loop />
        <Wheel id="timer-minutes" aria-label="Minutes" options={MINUTES} value={minutes} loop />
        <Wheel id="timer-seconds" aria-label="Seconds" options={SECONDS} value={seconds} loop />
      </WheelPicker>
      <p id="duration" class="text-slate-600">
        Duration: {hours()}:{pad(minutes() ?? 0)}:{pad(seconds() ?? 0)}
      </p>
    </section>
  );
}
// #endregion
