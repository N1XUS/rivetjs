import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Inbox } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { EmptyState } from "@rivetjs/ui/empty-state";

export const head = { title: "Empty state" };

// #region demo
export default function EmptyStateBasic() {
  const drafts = signal(0);
  return (
    <div class="grid gap-6 p-6 sm:grid-cols-2">
      <EmptyState id="default" />
      <EmptyState id="inbox" class="flex flex-col items-center gap-2">
        <Icon icon={Inbox} size={28} />
        <p>No messages yet</p>
        <Button id="compose" size="sm" variant="secondary" onPress={() => drafts.set(drafts() + 1)}>
          Write one
        </Button>
        <p class="text-xs">
          Drafts: <output id="drafts">{drafts()}</output>
        </p>
      </EmptyState>
    </div>
  );
}
// #endregion
