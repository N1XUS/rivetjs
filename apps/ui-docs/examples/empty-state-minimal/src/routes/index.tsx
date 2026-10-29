// Rivet-authored EmptyState demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { EmptyState } from "@rivetjs/ui/empty-state";

export const head = { title: "EmptyState: minimal" };

// #region demo
export function Minimal() {
  return (
    <EmptyState id="es-minimal">
      <EmptyState.Header>
        <EmptyState.Title>No results</EmptyState.Title>
        <EmptyState.Description>Try a different search or clear the filters.</EmptyState.Description>
      </EmptyState.Header>
    </EmptyState>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Minimal />
    </div>
  );
}
