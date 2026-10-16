// Rivet-authored ChatSource demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ChatSource } from "@rivetjs/ui/chat-source";
import { BookOpen } from "lucide";

export const head = { title: "ChatSource: Composable" };

// #region demo
export function Composable() {
  return (
    <ChatSource href="https://www.w3.org/WAI/ARIA/apg/" enablePreview>
      <ChatSource.Trigger>
        <ChatSource.Icon>
          <Icon icon={BookOpen} size={12} />
        </ChatSource.Icon>
        <ChatSource.Title>ARIA patterns</ChatSource.Title>
      </ChatSource.Trigger>
      <ChatSource.Preview>
        <p class="text-sm font-medium">ARIA Authoring Practices Guide</p>
        <p class="text-xs text-muted">Keyboard and screen reader behaviour for common widgets.</p>
      </ChatSource.Preview>
    </ChatSource>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Composable />
    </div>
  );
}
