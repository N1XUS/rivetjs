// Rivet-authored ItemCardGroupCollection demo (own content): grid layout, row actions, a disabled row and dynamic items.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
import { Cloud, Database, GitBranch, Mail, MessageSquare, Webhook } from "lucide";

export const head = { title: "ItemCardGroupCollection: Grid and Actions" };

// #region demo
const INTEGRATIONS = [
  { id: "git", name: "Git", detail: "Sync repositories", icon: GitBranch },
  { id: "storage", name: "Storage", detail: "Buckets and files", icon: Cloud },
  { id: "database", name: "Database", detail: "Postgres and MySQL", icon: Database },
  { id: "chat", name: "Chat", detail: "Channel alerts", icon: MessageSquare },
  { id: "email", name: "Email", detail: "Digest and alerts", icon: Mail },
  { id: "webhooks", name: "Webhooks", detail: "Coming soon", icon: Webhook },
];

export function GridActions() {
  const opened = signal("none");

  return (
    <div class="flex w-full max-w-2xl flex-col gap-3">
      <ItemCardGroupCollection
        id="icgc-grid"
        aria-label="Integrations"
        layout="grid"
        columns={3}
        variant="outline"
        items={INTEGRATIONS}
        disabledKeys={["webhooks"]}
        onAction={(key) => opened.set(String(key))}
      >
        {(item: (typeof INTEGRATIONS)[number]) => (
          <ItemCard id={item.id} textValue={item.name}>
            <ItemCard.Icon>
              <Icon icon={item.icon} size={18} />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title>{item.name}</ItemCard.Title>
              <ItemCard.Description>{item.detail}</ItemCard.Description>
            </ItemCard.Content>
          </ItemCard>
        )}
      </ItemCardGroupCollection>
      <p id="icgc-opened" class="text-sm text-muted">
        Opened: {opened()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <GridActions />
    </div>
  );
}
