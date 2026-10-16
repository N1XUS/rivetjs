// Rivet addition (no upstream demo): Slider shorthand, same parts as the compound form.
import { Slider } from "@rivetjs/ui/slider";

export const head = { title: "Slider: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <div class="flex w-full max-w-xs flex-col gap-8">
      <Slider defaultValue={30} label="Volume" />
      <Slider defaultValue={[100, 500]} maxValue={1000} step={50} label="Price range" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
