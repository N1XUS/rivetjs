// Rivet-authored ChatLoader demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChatLoader } from "@rivetjs/ui/chat-loader";

export const head = { title: "ChatLoader: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="flex w-80 flex-col gap-6">
      <ChatLoader.Dots aria-label="Thinking" />
      <ChatLoader.Pulse aria-label="Listening" />
      <ChatLoader.Spinner aria-label="Generating" />
      <ChatLoader.Skeleton lines={3} />
    </div>
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
