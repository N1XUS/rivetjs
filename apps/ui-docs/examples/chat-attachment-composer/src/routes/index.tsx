// Rivet-authored ChatAttachment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { ChatAttachment, ChatAttachmentInput } from "@rivetjs/ui/chat-attachment";
import { PromptInput } from "@rivetjs/ui/prompt-input";

export const head = { title: "ChatAttachment: Composer" };

// #region demo
interface Picked {
  id: number;
  name: string;
  size: number;
  type: string;
  src?: string;
}

export function Composer() {
  const files = signal<Picked[]>([]);
  const sent = signal("");
  return (
    <div class="flex w-[34rem] flex-col gap-3">
      <PromptInput
        onSubmit={(value) => {
          sent.set(`${value || "(no text)"} + ${files().length} files`);
          for (const file of files()) if (file.src) URL.revokeObjectURL(file.src);
          files.set([]);
        }}
      >
        <ChatAttachmentInput
          multiple
          onFilesSelected={(picked) =>
            files.set([
              ...files(),
              ...picked.map((file, index) => ({
                id: Date.now() + index,
                name: file.name,
                size: file.size,
                type: file.type,
                src: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
              })),
            ])
          }
        >
          <ChatAttachmentInput.Dropzone
            render={(attrs) => (
              <PromptInput.Shell {...attrs}>
                <PromptInput.Attachments>
                  <For each={files} by={(file: Picked) => file.id}>
                    {(file: () => Picked) => (
                      <ChatAttachment
                        name={file().name}
                        size={file().size}
                        mimeType={file().type}
                        src={file().src}
                        onRemove={() => {
                          const src = file().src;
                          if (src) URL.revokeObjectURL(src);
                          files.set(files().filter((f) => f.id !== file().id));
                        }}
                      />
                    )}
                  </For>
                </PromptInput.Attachments>
                <PromptInput.Content>
                  <PromptInput.TextArea placeholder="Drop files here or attach them" />
                </PromptInput.Content>
                <PromptInput.Toolbar>
                  <PromptInput.ToolbarStart>
                    <ChatAttachmentInput.Trigger />
                  </PromptInput.ToolbarStart>
                  <PromptInput.ToolbarEnd>
                    <PromptInput.Send />
                  </PromptInput.ToolbarEnd>
                </PromptInput.Toolbar>
              </PromptInput.Shell>
            )}
          />
        </ChatAttachmentInput>
      </PromptInput>
      <p class="text-sm text-muted">
        Last sent: <span id="composer-sent">{sent() || "nothing yet"}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Composer />
    </div>
  );
}
