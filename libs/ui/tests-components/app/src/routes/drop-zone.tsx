import { isFileDropItem, type DropEvent } from "@rivetjs/cdk/drop-zone";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone" };

// Rivet addition (feature set inspired by HeroUI Pro's public Drop Zone docs): drop files or pick them; each file becomes a
// row. Resumes on the first drag / press.
export default function DropZoneStory() {
  let nextId = 0;
  const files = signal<{ id: number; name: string; size: number }[]>([]);
  const add = (list: { name: string; size: number }[]) => files.set([...files(), ...list.map((f) => ({ id: nextId++, name: f.name, size: f.size }))]);
  const onDrop = async (e: DropEvent) => add(await Promise.all(e.items.filter(isFileDropItem).map((item) => item.getFile())));
  return (
    <main class="flex max-w-xl flex-col gap-8 bg-background p-6 text-foreground">
      <DropZone id="dz">
        <DropZone.Area onDrop={onDrop}>
          <DropZone.Icon />
          <DropZone.Label>Drag files here or click to browse</DropZone.Label>
          <DropZone.Description>Any file.</DropZone.Description>
          <DropZone.Trigger id="dz-browse" />
        </DropZone.Area>
        <DropZone.Input multiple onSelect={(list) => add([...list])} />
        <DropZone.FileList id="dz-files">
          <For each={files} by={(f) => f.id}>
            {(file) => (
              <DropZone.FileItem status="complete">
                <DropZone.FileFormatIcon format={file().name.split(".").pop()?.toUpperCase()} color="blue" />
                <DropZone.FileInfo>
                  <DropZone.FileName>{file().name}</DropZone.FileName>
                  <DropZone.FileMeta>{`${file().size} B`}</DropZone.FileMeta>
                </DropZone.FileInfo>
                <DropZone.FileRemoveTrigger onPress={() => files.set(files().filter((f) => f.id !== file().id))} />
              </DropZone.FileItem>
            )}
          </For>
        </DropZone.FileList>
      </DropZone>
      <DropZone>
        <DropZone.Area id="dz-off" isDisabled onDrop={onDrop}>
          <DropZone.Label>Disabled</DropZone.Label>
        </DropZone.Area>
      </DropZone>
    </main>
  );
}
