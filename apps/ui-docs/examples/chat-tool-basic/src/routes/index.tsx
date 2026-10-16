// Rivet-authored ChatTool demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChatTool } from "@rivetjs/ui/chat-tool";

export const head = { title: "ChatTool: Usage" };

// #region demo
export function Basic() {
  return (
    <ChatTool
      class="w-[28rem]"
      toolName="getForecast"
      triggerPrefix="Used tool: "
      state="output-available"
      input={{ city: "Annecy", days: 2 }}
      output={{ saturday: "18 °C, sunny", sunday: "16 °C, showers" }}
    />
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
