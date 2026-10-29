// Rivet-authored ChatTool demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatTool } from "@rivetjs/ui/chat-tool";

export const head = { title: "ChatTool: Composable" };

// #region demo
export function Composable() {
  return (
    <ChatTool class="w-[28rem]" toolName="searchDocs" state="output-available" defaultExpanded>
      <ChatTool.Trigger>
        <ChatTool.Icon />
        <span>Searched the docs</span>
        <ChatTool.StatusIcon />
      </ChatTool.Trigger>
      <ChatTool.Content>
        <ChatTool.Args label="Query" input="resumable event handlers" />
        <ChatTool.Result label="Top pages">
          <ul class="list-disc ps-5 text-sm">
            <li>Resumability guide</li>
            <li>Event handlers</li>
          </ul>
        </ChatTool.Result>
      </ChatTool.Content>
    </ChatTool>
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
