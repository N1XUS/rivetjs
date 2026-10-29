// Rivet-authored ChatSource demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatSource, ChatSources } from "@rivetjs/ui/chat-source";

export const head = { title: "ChatSource: Grouped" };

// #region demo
export function Grouped() {
  return (
    <ChatSources class="w-96">
      <ChatSources.Trigger>3 sources</ChatSources.Trigger>
      <ChatSources.Content>
        <ChatSources.List>
          <ChatSource href="https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing" title="field-sizing" />
          <ChatSource href="https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/" title="Disclosure pattern" />
          <ChatSource title="design-notes.md" />
        </ChatSources.List>
      </ChatSources.Content>
    </ChatSources>
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
