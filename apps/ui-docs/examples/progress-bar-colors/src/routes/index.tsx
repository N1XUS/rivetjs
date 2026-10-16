// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/progress-bar/colors.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ProgressBar } from "@rivetjs/ui/progress-bar";

export const head = { title: "ProgressBar: Colors" };

// #region demo
export function Colors() {
  return (
    <div class="flex w-64 flex-col gap-6">
      <ProgressBar aria-label="Default" color="default" value={50}>
        <Label>Default</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Accent" color="accent" value={50}>
        <Label>Accent</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Success" color="success" value={50}>
        <Label>Success</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Warning" color="warning" value={50}>
        <Label>Warning</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ProgressBar aria-label="Danger" color="danger" value={50}>
        <Label>Danger</Label>
        <ProgressBar.Output />
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Colors />
    </div>
  );
}
