// Rivet-authored EmptyState demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Sparkles } from "lucide";

export const head = { title: "EmptyState: with background" };

// #region demo
export function WithBackground() {
  return (
    <EmptyState id="es-bg" class="w-full max-w-md rounded-3xl bg-linear-to-b from-accent-soft to-transparent">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <Icon icon={Sparkles} size={24} />
        </EmptyState.Media>
        <EmptyState.Title>Start with a template</EmptyState.Title>
        <EmptyState.Description>Pick a layout and fill in your own content.</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button size="sm">Browse templates</Button>
        <Button size="sm" variant="tertiary">
          Blank page
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithBackground />
    </div>
  );
}
