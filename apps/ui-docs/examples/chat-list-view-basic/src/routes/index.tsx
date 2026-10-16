// Rivet-authored ChatListView demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ChatListView } from "@rivetjs/ui/chat-list-view";
import { MessageSquare } from "lucide";

export const head = { title: "ChatListView: Usage" };

// #region demo
const THREADS = [
  { id: "porto", title: "Weekend in Porto", preview: "Here is a two-day plan with a river cruise…", meta: "2m" },
  { id: "invoice", title: "Invoice reminder email", preview: "Subject: Friendly reminder about invoice 1042", meta: "1h" },
  { id: "sql", title: "Slow SQL query", preview: "Add an index on orders(customer_id, created_at)", meta: "Yesterday" },
];

export function Basic() {
  const current = signal("porto");
  return (
    <ChatListView aria-label="Chats" class="w-80">
      {THREADS.map((thread) => (
        <ChatListView.Item id={`thread-${thread.id}`} isCurrent={() => current() === thread.id} onPress={() => current.set(thread.id)}>
          <ChatListView.Icon>
            <Icon icon={MessageSquare} size={16} />
          </ChatListView.Icon>
          <ChatListView.ItemContent>
            <ChatListView.Title>{thread.title}</ChatListView.Title>
            <ChatListView.Preview>{thread.preview}</ChatListView.Preview>
          </ChatListView.ItemContent>
          <ChatListView.Meta>{thread.meta}</ChatListView.Meta>
        </ChatListView.Item>
      ))}
    </ChatListView>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
