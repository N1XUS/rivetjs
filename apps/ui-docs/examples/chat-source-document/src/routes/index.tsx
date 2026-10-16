// Rivet-authored ChatSource demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChatSource } from "@rivetjs/ui/chat-source";

export const head = { title: "ChatSource: Document" };

// #region demo
export function DocumentSource() {
  return (
    <p class="max-w-md text-sm leading-7">
      Revenue grew 12 % in the third quarter <ChatSource title="Q3-report.pdf" description="Page 4: revenue by region, July to September." />.
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DocumentSource />
    </div>
  );
}
