// Rivet-authored ChatAttachment demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { ChatAttachment, ChatAttachmentGroup } from "@rivetjs/ui/chat-attachment";

export const head = { title: "ChatAttachment: Grouped" };

// #region demo
interface FileItem {
  id: number;
  name: string;
  size: number;
}

const FILES: FileItem[] = [
  { id: 1, name: "budget-2027.xlsx", size: 91234 },
  { id: 2, name: "contract-draft.docx", size: 48211 },
  { id: 3, name: "screenshots.zip", size: 5242880 },
  { id: 4, name: "interview.mp3", size: 3145728 },
];

export function Grouped() {
  const files = signal(FILES);
  return (
    <div class="flex w-[32rem] flex-col gap-2">
      <ChatAttachmentGroup>
        <For each={files} by={(file: FileItem) => file.id}>
          {(file: () => FileItem) => (
            <ChatAttachment name={file().name} size={file().size} onRemove={() => files.set(files().filter((f) => f.id !== file().id))} />
          )}
        </For>
      </ChatAttachmentGroup>
      <p id="attach-count" class="text-xs text-muted">
        {files().length} files
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Grouped />
    </div>
  );
}
