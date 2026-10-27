// Rivet-authored EmptyState demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Inbox } from "lucide";

export const head = { title: "EmptyState: full height" };

// #region demo
export function FullHeight() {
  return (
    <section class="flex h-80 w-full max-w-lg flex-col rounded-2xl bg-surface shadow-surface">
      <header class="border-b border-separator px-4 py-3 text-sm font-medium">Inbox</header>
      <EmptyState id="es-full" class="flex-1">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Icon icon={Inbox} size={24} />
          </EmptyState.Media>
          <EmptyState.Title>Inbox zero</EmptyState.Title>
          <EmptyState.Description>New messages show up here.</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </section>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <FullHeight />
    </div>
  );
}
