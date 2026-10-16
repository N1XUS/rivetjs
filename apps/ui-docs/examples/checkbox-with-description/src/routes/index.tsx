// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Checkbox: With Description" };

// #region demo
export function WithDescription() {
  return (
    <Checkbox name="description-notifications">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Email notifications
      </Checkbox.Content>
      <Description>Get notified when someone mentions you in a comment</Description>
    </Checkbox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
