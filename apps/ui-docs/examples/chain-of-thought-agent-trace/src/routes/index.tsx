// Rivet-authored ChainOfThought demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { ChainOfThought } from "@rivetjs/ui/chain-of-thought";
import { FileText, Globe, Search } from "lucide";

export const head = { title: "ChainOfThought: Agent Trace" };

// #region demo
export function AgentTrace() {
  return (
    <ChainOfThought class="w-[26rem]" defaultExpanded>
      <ChainOfThought.Trigger>Researching venues</ChainOfThought.Trigger>
      <ChainOfThought.Content>
        <ChainOfThought.Steps>
          <ChainOfThought.Step label="Searched “quiet venues near the old port”" icon={Search}>
            12 results
          </ChainOfThought.Step>
          <ChainOfThought.Step label="Opened harbour-hall.example" icon={Globe}>
            Capacity 80, available on Friday.
          </ChainOfThought.Step>
          <ChainOfThought.Step label="Fetching the price list" status="error">
            The page timed out.
          </ChainOfThought.Step>
          <ChainOfThought.Step label="Writing the summary" icon={FileText} status="active" />
          <ChainOfThought.Step label="Send the shortlist" status="pending" />
        </ChainOfThought.Steps>
      </ChainOfThought.Content>
    </ChainOfThought>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <AgentTrace />
    </div>
  );
}
