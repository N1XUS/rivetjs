// Rivet-authored DropZone demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Disabled" };

// #region demo
export function Disabled() {
  return (
    <DropZone id="dz-disabled" class="w-full max-w-md">
      <DropZone.Area isDisabled>
        <DropZone.Icon />
        <DropZone.Label>Uploads are closed</DropZone.Label>
        <DropZone.Description>Try again tomorrow.</DropZone.Description>
        <DropZone.Trigger isDisabled />
      </DropZone.Area>
      <DropZone.Input disabled />
    </DropZone>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Disabled />
    </div>
  );
}
