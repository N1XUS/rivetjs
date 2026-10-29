// Rivet-authored ChatTool demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatTool, ChatToolGroup } from "@rivetjs/ui/chat-tool";

export const head = { title: "ChatTool: Grouped" };

// #region demo
export function Grouped() {
  return (
    <ChatToolGroup class="w-[28rem]">
      <ChatToolGroup.Trigger>Used 3 tools</ChatToolGroup.Trigger>
      <ChatToolGroup.Content>
        <ChatTool toolName="searchFlights" state="output-available" input={{ from: "LYS", to: "LIS" }} output={{ results: 6 }} />
        <ChatTool toolName="searchHotels" state="output-available" input={{ city: "Lisbon" }} output={{ results: 24 }} />
        <ChatTool toolName="getForecast" state="input-available" input={{ city: "Lisbon" }} />
      </ChatToolGroup.Content>
    </ChatToolGroup>
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
