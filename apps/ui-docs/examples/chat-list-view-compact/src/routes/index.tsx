// Rivet-authored ChatListView demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { ChatListView } from "@rivetjs/ui/chat-list-view";

export const head = { title: "ChatListView: Compact" };

// #region demo
const TODAY = [
  { id: "porto", title: "Weekend in Porto" },
  { id: "invoice", title: "Invoice reminder email" },
];
const EARLIER = [
  { id: "sql", title: "Slow SQL query" },
  { id: "names", title: "Bakery name ideas" },
  { id: "cv", title: "Rewrite my CV summary" },
];

export function Compact() {
  const current = signal("invoice");
  return (
    <ChatListView aria-label="Chats" variant="compact" class="w-64">
      <ChatListView.Section>Today</ChatListView.Section>
      {TODAY.map((thread) => (
        <ChatListView.Item id={`compact-${thread.id}`} isCurrent={() => current() === thread.id} onPress={() => current.set(thread.id)}>
          <ChatListView.Title>{thread.title}</ChatListView.Title>
        </ChatListView.Item>
      ))}
      <ChatListView.Section>Previous 7 days</ChatListView.Section>
      {EARLIER.map((thread) => (
        <ChatListView.Item id={`compact-${thread.id}`} isCurrent={() => current() === thread.id} onPress={() => current.set(thread.id)}>
          <ChatListView.Title>{thread.title}</ChatListView.Title>
        </ChatListView.Item>
      ))}
    </ChatListView>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Compact />
    </div>
  );
}
