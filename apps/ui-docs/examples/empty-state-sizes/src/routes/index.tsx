// Rivet-authored EmptyState demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Bell } from "lucide";

export const head = { title: "EmptyState: sizes" };

// #region demo
const SIZES = ["sm", "md", "lg"] as const;

export function Sizes() {
  return (
    <div id="es-sizes" class="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
      {SIZES.map((size) => (
        <EmptyState size={size} variant="outline">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Icon icon={Bell} size={24} />
            </EmptyState.Media>
            <EmptyState.Title>All caught up</EmptyState.Title>
            <EmptyState.Description>Size {size}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sizes />
    </div>
  );
}
