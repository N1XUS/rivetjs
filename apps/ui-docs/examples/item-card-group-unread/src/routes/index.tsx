// Rivet-authored ItemCardGroup demo (Rivet addition; collection mode on the cdk GridList, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Avatar } from "@rivetjs/ui/avatar";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
import { Segment } from "@rivetjs/ui/segment";
import { BellOff } from "lucide";

export const head = { title: "ItemCardGroup: Unread state" };

// #region demo
type Note = { id: string; from: string; initials: string; text: string; time: string };

const NOTES: Note[] = [
  { id: "n1", from: "Mira Okafor", initials: "MO", text: "Left a comment on the Q3 roadmap", time: "2 min" },
  { id: "n2", from: "Jonas Wilde", initials: "JW", text: "Assigned you “Fix the export button”", time: "1 h" },
  { id: "n3", from: "Lea Brandt", initials: "LB", text: "Shared the brand assets folder", time: "Yesterday" },
];

export function Unread() {
  const unread = signal(new Set(["n1", "n2"]));
  const filter = signal<string | null>("all");
  const visible = () => NOTES.filter((n) => filter() !== "unread" || unread().has(n.id));
  const markRead = (id: string) => {
    const next = new Set(unread());
    next.delete(id);
    unread.set(next);
  };
  return (
    <div class="flex w-full max-w-md flex-col gap-3">
      <Segment id="icg-filter" aria-label="Show" selectedKey={filter} size="sm" class="self-end">
        <Segment.Item id="all">All</Segment.Item>
        <Segment.Item id="unread">Unread</Segment.Item>
      </Segment>
      <ItemCardGroupCollection
        id="icg-inbox"
        aria-label="Notifications"
        items={visible}
        onAction={(key) => markRead(String(key))}
        renderEmptyState={() => (
          <EmptyState size="sm" class="py-8">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Icon icon={BellOff} size={18} />
              </EmptyState.Media>
              <EmptyState.Title>All caught up</EmptyState.Title>
            </EmptyState.Header>
          </EmptyState>
        )}
      >
        {(n: Note) => (
          <ItemCard id={n.id} textValue={`${n.from}: ${n.text}`} isUnread={() => unread().has(n.id)}>
            <Avatar size="sm">
              <Avatar.Fallback>{n.initials}</Avatar.Fallback>
            </Avatar>
            <ItemCard.Content>
              <ItemCard.Title>{n.from}</ItemCard.Title>
              <ItemCard.Description>{n.text}</ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <span class="text-xs text-muted">{n.time}</span>
              <ItemCard.Indicator aria-label="Unread" />
            </ItemCard.Action>
          </ItemCard>
        )}
      </ItemCardGroupCollection>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Unread />
    </div>
  );
}
