// Rivet-authored EmptyState demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { EmptyState } from "@rivetjs/ui/empty-state";

export const head = { title: "EmptyState: with avatar" };

// #region demo
export function WithAvatar() {
  return (
    <EmptyState id="es-avatar">
      <EmptyState.Header>
        <EmptyState.Media>
          <Avatar size="lg">
            <Avatar.Fallback>MK</Avatar.Fallback>
          </Avatar>
        </EmptyState.Media>
        <EmptyState.Title>Mira has no open tasks</EmptyState.Title>
        <EmptyState.Description>Assign one from the backlog to get started.</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button size="sm" variant="secondary">
          Assign a task
        </Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithAvatar />
    </div>
  );
}
