// Rivet-authored EmptyState demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import { Button } from "@rivetjs/ui/button";
import { EmptyState } from "@rivetjs/ui/empty-state";

export const head = { title: "EmptyState: with avatar group" };

// #region demo
const TEAM = ["AL", "BO", "CY"];

export function WithAvatarGroup() {
  return (
    <EmptyState id="es-team">
      <EmptyState.Header>
        <EmptyState.Media>
          <AvatarGroup>
            {TEAM.map((initials) => (
              <Avatar>
                <Avatar.Fallback>{initials}</Avatar.Fallback>
              </Avatar>
            ))}
          </AvatarGroup>
        </EmptyState.Media>
        <EmptyState.Title>No shared docs</EmptyState.Title>
        <EmptyState.Description>Docs your team shares with you land here.</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button size="sm">Invite teammates</Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithAvatarGroup />
    </div>
  );
}
