// Rivet-authored DropZone demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { isFileDropItem, type DropEvent } from "@rivetjs/cdk/drop-zone";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Multiple Files" };

// #region demo
export function Multiple() {
  const count = signal(0);
  const onDrop = (e: DropEvent) => count.set(count() + e.items.filter(isFileDropItem).length);
  return (
    <div id="dz-multiple" class="w-full max-w-md flex flex-col gap-3">
      <DropZone>
        <DropZone.Area onDrop={onDrop}>
          <DropZone.Icon />
          <DropZone.Label>Drop several files at once</DropZone.Label>
          <DropZone.Description>Select many in the picker with Shift or Cmd.</DropZone.Description>
          <DropZone.Trigger />
        </DropZone.Area>
        <DropZone.Input multiple onSelect={(list) => count.set(count() + list.length)} />
      </DropZone>
      <p id="dz-multiple-count" class="text-sm text-muted">
        Files received: {count}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Multiple />
    </div>
  );
}
