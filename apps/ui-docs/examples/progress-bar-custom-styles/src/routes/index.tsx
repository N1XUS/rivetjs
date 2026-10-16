// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-bar/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ProgressBar } from "@rivetjs/ui/progress-bar";

export const head = { title: "ProgressBar: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <ProgressBar aria-label="Upload progress" class="w-64" value={45}>
      <Label class="font-medium text-foreground">Uploading resume.pdf</Label>
      <ProgressBar.Output class="text-xs text-muted tabular-nums" />
      <ProgressBar.Track class="rounded-full bg-default">
        <ProgressBar.Fill class="rounded-full bg-accent" />
      </ProgressBar.Track>
    </ProgressBar>
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
