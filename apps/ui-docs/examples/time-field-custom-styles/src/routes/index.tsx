// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/time-field/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { TimeField } from "@rivetjs/ui/time-field";

export const head = { title: "TimeField: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <TimeField class="w-full max-w-48 gap-1.5" name="reminder">
      <Label class="font-medium text-foreground">Reminder time</Label>
      <Description>Daily check-in notification.</Description>
      <TimeField.Group class="rounded-xl border border-border/80 bg-surface px-2 py-1 shadow-sm ring-1 ring-accent/5 focus-within:border-accent/25 focus-within:ring-2 focus-within:ring-accent/15">
        <TimeField.Input>{(segment) => <TimeField.Segment class="text-foreground" segment={segment} />}</TimeField.Input>
      </TimeField.Group>
    </TimeField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
