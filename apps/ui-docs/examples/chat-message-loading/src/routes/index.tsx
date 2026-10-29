// Rivet-authored ChatMessage demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatLoader } from "@rivetjs/ui/chat-loader";
import { ChatMessage } from "@rivetjs/ui/chat-message";

export const head = { title: "ChatMessage: Loading" };

// #region demo
export function Loading() {
  return (
    <div class="flex w-[28rem] flex-col gap-4">
      <ChatMessage.User>
        <ChatMessage.Bubble>Summarise this morning’s meeting notes.</ChatMessage.Bubble>
      </ChatMessage.User>
      <ChatMessage.Assistant>
        <ChatMessage.Avatar fallback="AI" />
        <ChatMessage.Body>
          <ChatLoader.Dots aria-label="Thinking" />
        </ChatMessage.Body>
      </ChatMessage.Assistant>
      <ChatMessage.Assistant>
        <ChatMessage.Avatar fallback="AI" />
        <ChatMessage.Body>
          <ChatLoader.Skeleton lines={2} hideAvatar />
        </ChatMessage.Body>
      </ChatMessage.Assistant>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Loading />
    </div>
  );
}
