// Rivet-authored DropZone demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Compact File List" };

// #region demo
const FILES = [
  { id: 0, name: "Q3 report.pdf", size: "1.2 MB" },
  { id: 1, name: "Logo.png", size: "240 KB" },
];
let nextId = FILES.length;

export function Compact() {
  const files = signal(FILES);
  return (
    <DropZone id="dz-compact" class="w-full max-w-md">
      <DropZone.Area class="flex-row gap-3 py-3">
        <DropZone.Icon />
        <DropZone.Label>Drop files or</DropZone.Label>
        <DropZone.Trigger variant="ghost">browse</DropZone.Trigger>
      </DropZone.Area>
      <DropZone.Input
        multiple
        onSelect={(list) => files.set([...files(), ...[...list].map((f) => ({ id: nextId++, name: f.name, size: `${Math.round(f.size / 1024)} KB` }))])}
      />
      <DropZone.FileList class="gap-1">
        <For each={files} by={(f) => f.id}>
          {(file) => (
            <DropZone.FileItem class="py-1" status="complete">
              <DropZone.FileFormatIcon class="scale-75" />
              <DropZone.FileInfo class="flex-row items-baseline justify-between gap-2">
                <DropZone.FileName>{file().name}</DropZone.FileName>
                <DropZone.FileMeta>{file().size}</DropZone.FileMeta>
              </DropZone.FileInfo>
              <DropZone.FileRemoveTrigger onPress={() => files.set(files().filter((f) => f.id !== file().id))} />
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
      <Compact />
    </div>
  );
}
