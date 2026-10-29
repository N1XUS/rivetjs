// Rivet-authored DropZone demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { isFileDropItem, type DropEvent } from "@rivetjs/cdk/drop-zone";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Max Size Limit" };

// #region demo
const LIMIT = 1024 * 1024;
type Row = { id: number; name: string; ok: boolean; meta: string };
let nextId = 1;

export function MaxSize() {
  const rows = signal<Row[]>([{ id: 0, name: "Huge video.mov", ok: false, meta: "48.0 MB, over the 1 MB limit" }]);
  const add = (files: File[]) =>
    rows.set([
      ...rows(),
      ...files.map((f) => ({
        id: nextId++,
        name: f.name,
        ok: f.size <= LIMIT,
        meta: f.size <= LIMIT ? `${Math.round(f.size / 1024)} KB` : `${(f.size / LIMIT).toFixed(1)} MB, over the 1 MB limit`,
      })),
    ]);
  const onDrop = async (e: DropEvent) => add(await Promise.all(e.items.filter(isFileDropItem).map((item) => item.getFile())));
  return (
    <DropZone id="dz-max" class="w-full max-w-md">
      <DropZone.Area onDrop={onDrop}>
        <DropZone.Icon />
        <DropZone.Label>Drag files here or click to browse</DropZone.Label>
        <DropZone.Description>Up to 1 MB per file.</DropZone.Description>
        <DropZone.Trigger />
      </DropZone.Area>
      <DropZone.Input multiple onSelect={(list) => add([...list])} />
      <DropZone.FileList>
        <For each={rows} by={(r) => r.id}>
          {(row) => (
            <DropZone.FileItem status={row().ok ? "complete" : "failed"}>
              <DropZone.FileFormatIcon format={row().name.split(".").pop()?.toUpperCase()} color={row().ok ? "gray" : "red"} />
              <DropZone.FileInfo>
                <DropZone.FileName>{row().name}</DropZone.FileName>
                <DropZone.FileMeta>{row().meta}</DropZone.FileMeta>
              </DropZone.FileInfo>
              <DropZone.FileRemoveTrigger onPress={() => rows.set(rows().filter((r) => r.id !== row().id))} />
            </DropZone.FileItem>
          )}
        </For>
      </DropZone.FileList>
    </DropZone>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <MaxSize />
    </div>
  );
}
