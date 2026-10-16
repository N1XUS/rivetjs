// Rivet addition (no upstream demo): NumberField shorthand, same parts as the compound form.
import { NumberField } from "@rivetjs/ui/number-field";

export const head = { title: "NumberField: Shorthand" };

// #region demo
export function Shorthand() {
  return <NumberField class="w-full max-w-64" defaultValue={1024} minValue={0} name="shorthand-width" label="Width" description="In pixels" />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
