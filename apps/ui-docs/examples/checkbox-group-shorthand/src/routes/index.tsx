// Rivet addition (no upstream demo): CheckboxGroup shorthand, same parts as the compound form.
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";

export const head = { title: "CheckboxGroup: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <CheckboxGroup
      name="shorthand-interests"
      label="Select your interests"
      description="Choose all that apply"
      items={[
        { value: "coding", label: "Coding", description: "Love building software" },
        { value: "design", label: "Design", description: "Enjoy creating beautiful interfaces" },
        { value: "writing", label: "Writing", description: "Passionate about content creation" },
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
