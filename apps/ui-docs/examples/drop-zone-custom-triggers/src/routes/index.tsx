// Rivet-authored DropZone demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Custom Triggers" };

// #region demo
export function CustomTriggers() {
  const picked = signal("Nothing picked");
  return (
    <div id="dz-triggers" class="w-full max-w-md flex flex-col gap-3">
      <DropZone>
        <DropZone.Area>
          <DropZone.Icon />
          <DropZone.Label>Attach your resume</DropZone.Label>
          <div class="flex gap-2">
            <DropZone.Trigger variant="primary">Upload resume</DropZone.Trigger>
            <DropZone.Trigger variant="tertiary">Choose another file</DropZone.Trigger>
          </div>
        </DropZone.Area>
        <DropZone.Input accept=".pdf,.doc,.docx" onSelect={(list) => picked.set(list[0]?.name ?? "Nothing picked")} />
      </DropZone>
      <p id="dz-triggers-picked" class="text-sm text-muted">
        {picked}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CustomTriggers />
    </div>
  );
}
