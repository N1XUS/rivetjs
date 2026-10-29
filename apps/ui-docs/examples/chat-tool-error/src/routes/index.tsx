// Rivet-authored ChatTool demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChatTool } from "@rivetjs/ui/chat-tool";

export const head = { title: "ChatTool: Error" };

// #region demo
export function ErrorState() {
  return (
    <ChatTool
      class="w-[28rem]"
      toolName="sendInvoice"
      triggerPrefix="Tool: "
      state="output-error"
      input={{ customer: "c_1042", amount: 240 }}
      errorText="The payment service did not answer within 10 seconds."
      defaultExpanded
    />
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ErrorState />
    </div>
  );
}
