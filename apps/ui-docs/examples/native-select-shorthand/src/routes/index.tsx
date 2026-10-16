// Rivet addition (no upstream demo): NativeSelect shorthand, same parts as the compound form.
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <NativeSelect
      class="w-64"
      defaultValue="oolong"
      label="Tea"
      description="Brewed fresh"
      items={[
        { value: "green", label: "Green" },
        { value: "oolong", label: "Oolong" },
        { value: "black", label: "Black" },
      ]}
    />
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
