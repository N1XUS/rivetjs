// Rivet-authored DropZone demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { isFileDropItem, type DropEvent } from "@rivetjs/cdk/drop-zone";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: With File List" };

// #region demo
type Upload = { id: number; name: string; size: string; format: string; color: string; status: "uploading" | "complete" | "failed"; progress: number };

let nextId = 0;
const formatOf = (name: string) => name.split(".").pop()?.toUpperCase() ?? "FILE";
const colorOf = (format: string) => (format === "PDF" ? "red" : format === "PNG" || format === "JPG" ? "blue" : format === "DOCX" ? "accent" : "gray");
const sizeOf = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const toUpload = (file: File): Upload => {
  const format = formatOf(file.name);
  return { id: nextId++, name: file.name, size: sizeOf(file.size), format, color: colorOf(format), status: "uploading", progress: 0 };
};

const SEED: Upload[] = [
  { id: -1, name: "Proposal.pdf", size: "2.4 MB", format: "PDF", color: "red", status: "complete", progress: 100 },
  { id: -2, name: "Brief.docx", size: "860 KB", format: "DOCX", color: "accent", status: "uploading", progress: 40 },
  { id: -3, name: "Cover.png", size: "4.1 MB", format: "PNG", color: "blue", status: "failed", progress: 0 },
];

export function WithFileList() {
  const files = signal<Upload[]>(SEED);
  const update = (id: number, patch: Partial<Upload>) => files.set(files().map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const start = (upload: Upload) => {
    const timer = setInterval(() => {
      const current = files().find((f) => f.id === upload.id);
      if (!current) return clearInterval(timer);
      const progress = Math.min(100, current.progress + 20);
      update(upload.id, progress === 100 ? { progress, status: "complete" } : { progress });
      if (progress === 100) clearInterval(timer);
    }, 300);
  };
  const add = (list: File[]) => {
    const next = list.map(toUpload);
    files.set([...files(), ...next]);
    next.forEach(start);
  };
  const remove = (file: Upload) => files.set(files().filter((f) => f.id !== file.id));
  const retry = (file: Upload) => {
    update(file.id, { status: "uploading", progress: 0 });
    start(file);
  };
  const onDrop = async (e: DropEvent) => add(await Promise.all(e.items.filter(isFileDropItem).map((item) => item.getFile())));
  return (
    <DropZone id="dz-list" class="w-full max-w-md">
      <DropZone.Area onDrop={onDrop}>
        <DropZone.Icon />
        <DropZone.Label>Drag files here or click to browse</DropZone.Label>
        <DropZone.Description>PDF, DOCX, PNG, or JPG up to 10 MB.</DropZone.Description>
        <DropZone.Trigger />
      </DropZone.Area>
      <DropZone.Input multiple onSelect={(list) => add([...list])} />
      <DropZone.FileList>
        <For each={files} by={(f) => f.id}>
          {(file) => (
            <DropZone.FileItem status={file().status}>
              <DropZone.FileFormatIcon format={file().format} color={file().color} />
              <DropZone.FileInfo>
                <DropZone.FileName>{file().name}</DropZone.FileName>
                <DropZone.FileMeta>{file().status === "failed" ? "Upload failed" : file().size}</DropZone.FileMeta>
              </DropZone.FileInfo>
              {file().status === "uploading" ? (
                <DropZone.FileProgress value={file().progress}>
                  <DropZone.FileProgressTrack>
                    <DropZone.FileProgressFill />
                  </DropZone.FileProgressTrack>
                </DropZone.FileProgress>
              ) : null}
              {file().status === "failed" ? <DropZone.FileRetryTrigger onPress={() => retry(file())} /> : null}
              <DropZone.FileRemoveTrigger onPress={() => remove(file())} />
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
      <WithFileList />
    </div>
  );
}
