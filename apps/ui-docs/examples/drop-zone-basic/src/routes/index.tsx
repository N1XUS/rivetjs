// Rivet-authored DropZone demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { isFileDropItem, type DropEvent } from "@rivetjs/cdk/drop-zone";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Usage" };

// #region demo
export function Basic() {
  const names = signal("No files yet");
  const show = (files: File[]) => names.set(files.map((f) => f.name).join(", ") || "No files yet");
  const onDrop = async (e: DropEvent) => show(await Promise.all(e.items.filter(isFileDropItem).map((item) => item.getFile())));
  return (
    <div id="dz-basic" class="w-full max-w-md flex flex-col gap-3">
      <DropZone>
        <DropZone.Area onDrop={onDrop}>
          <DropZone.Icon />
          <DropZone.Label>Drag files here or click to browse</DropZone.Label>
          <DropZone.Description>PDF, DOCX, PNG, or JPG up to 10 MB.</DropZone.Description>
          <DropZone.Trigger />
        </DropZone.Area>
        <DropZone.Input multiple onSelect={(list) => show([...list])} />
      </DropZone>
      <p id="dz-basic-names" class="text-sm text-muted">
        {names}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
