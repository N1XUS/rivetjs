// Rivet-authored ChainOfThought demo (Rivet addition, own content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ChainOfThought } from "@rivetjs/ui/chain-of-thought";
import { StreamingText } from "@rivetjs/ui/streaming-text";
import { FileText, Globe, Search } from "lucide";

export const head = { title: "ChainOfThought: Agent trace streaming" };

// #region demo
const RESEARCH = [
  { label: "Searched “quiet venues near the old port”", icon: Search, detail: "12 results" },
  { label: "Opened harbour-hall.example", icon: Globe, detail: "Capacity 80, available on Friday." },
  { label: "Opened the-loft.example", icon: Globe, detail: "Capacity 60, a terrace, catering included." },
  { label: "Writing the shortlist", icon: FileText, detail: "Two venues, with prices and dates." },
];

export function AgentTraceStreaming() {
  // Steps done so far; RESEARCH.length = finished. A local timer stands in for the agent's event stream.
  const done = signal(RESEARCH.length);
  const running = () => done() < RESEARCH.length;
  const run = () => {
    if (running()) return;
    done.set(0);
    const tick = () => {
      done.set(done() + 1);
      if (running()) setTimeout(tick, 600);
    };
    setTimeout(tick, 600);
  };
  return (
    <div class="flex w-[26rem] flex-col items-start gap-3">
      <Button id="trace-run" size="sm" variant="secondary" isDisabled={running} onPress={() => run()}>
        Run the agent
      </Button>
      <ChainOfThought class="w-full">
        <ChainOfThought.Trigger>Planned the search for 1 second</ChainOfThought.Trigger>
        <ChainOfThought.Content>
          <ChainOfThought.Steps>
            <ChainOfThought.Step label="Read the request: 60 to 80 guests, Friday evening" />
            <ChainOfThought.Step label="Chose sources: venue sites and maps" />
          </ChainOfThought.Steps>
        </ChainOfThought.Content>
      </ChainOfThought>
      <ChainOfThought id="trace-research" class="w-full" defaultExpanded isStreaming={running}>
        <ChainOfThought.Trigger>{running() ? "Researching venues…" : "Researched venues for 4 seconds"}</ChainOfThought.Trigger>
        <ChainOfThought.Content>
          <ChainOfThought.Steps>
            {RESEARCH.map((step, i) => (
              <ChainOfThought.Step
                id={`trace-step-${i}`}
                label={step.label}
                icon={step.icon}
                status={i < done() ? "complete" : i === done() ? "active" : "pending"}
              >
                <StreamingText content={() => (i < done() ? step.detail : "")} isStreaming={running} />
              </ChainOfThought.Step>
            ))}
          </ChainOfThought.Steps>
        </ChainOfThought.Content>
      </ChainOfThought>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <AgentTraceStreaming />
    </div>
  );
}
