import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback" };

// Rivet addition (feature set inspired by HeroUI Pro's public Pressable Feedback docs): ripple + highlight, hold to confirm,
// progress feedback; a standalone Ripple inside a ui Button (`#pf-button`). Resumes on the first press.
export default function PressableFeedbackStory() {
  const held = signal(0);
  const sent = signal(0);
  return (
    <main class="flex max-w-xl flex-col items-start gap-6 bg-background p-6 text-foreground">
      <PressableFeedback id="pf-ripple" class="rounded-xl bg-default px-6 py-3 text-sm font-medium">
        <PressableFeedback.Highlight />
        <PressableFeedback.Ripple />
        Ripple
      </PressableFeedback>
      <PressableFeedback id="pf-hold" class="rounded-xl bg-danger-soft px-6 py-3 text-sm font-medium text-danger">
        <PressableFeedback.HoldConfirm duration={400} class="bg-danger text-danger-foreground" onComplete={() => held.set(held() + 1)}>
          Deleted
        </PressableFeedback.HoldConfirm>
        Hold to delete
      </PressableFeedback>
      <p id="pf-held">{held()}</p>
      <PressableFeedback id="pf-progress" class="rounded-xl bg-accent-soft px-6 py-3 text-sm font-medium text-accent">
        <PressableFeedback.ProgressFeedback duration={300} resetDelay={300} class="bg-accent text-accent-foreground" onComplete={() => sent.set(sent() + 1)}>
          Sent
        </PressableFeedback.ProgressFeedback>
        Send
      </PressableFeedback>
      <p id="pf-sent">{sent()}</p>
      <Button id="pf-button" variant="secondary">
        <PressableFeedback.Ripple />
        Button ripple
      </Button>
    </main>
  );
}
