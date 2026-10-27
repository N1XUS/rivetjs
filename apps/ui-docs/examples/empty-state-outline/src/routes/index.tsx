// Rivet-authored EmptyState demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { FolderPlus } from "lucide";

export const head = { title: "EmptyState: outline" };

// #region demo
export function Outline() {
  return (
    <EmptyState id="es-outline" variant="outline" class="w-full max-w-md">
      <EmptyState.Header>
        <EmptyState.Media variant="icon">
          <Icon icon={FolderPlus} size={24} />
        </EmptyState.Media>
        <EmptyState.Title>No projects yet</EmptyState.Title>
        <EmptyState.Description>Projects group your boards, files and people.</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content>
        <Button size="sm">New project</Button>
      </EmptyState.Content>
    </EmptyState>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Outline />
    </div>
  );
}
