// Rivet-authored ChatAttachment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { ChatAttachment, ChatAttachmentGroup } from "@rivetjs/ui/chat-attachment";
import cactusImage from "../assets/cactus.jpg?image";

export const head = { title: "ChatAttachment: Usage" };

// #region demo
export function Basic() {
  const removed = signal(false);
  return (
    <ChatAttachmentGroup>
      <ChatAttachment name="cactus.jpg" mimeType="image/jpeg" size={184320} src={cactusImage.src} />
      <ChatAttachment name="Q3-report.pdf" size={482133} />
      <Show when={() => !removed()}>
        <ChatAttachment id="notes-file" name="notes.md" size={2048} onRemove={() => removed.set(true)} />
      </Show>
    </ChatAttachmentGroup>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
