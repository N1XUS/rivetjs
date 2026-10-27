// Rivet-authored ListView demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ListView } from "@rivetjs/ui/list-view";
import { Inbox } from "lucide";

export const head = { title: "ListView: Empty State" };

// #region demo
export function Empty() {
  return (
    <div id="lv-empty" class="w-full max-w-md">
      <ListView
        aria-label="Messages"
        items={[] as { id: string; subject: string }[]}
        renderEmptyState={() => (
          <ListView.EmptyState>
            <Icon icon={Inbox} size={24} />
            No messages
          </ListView.EmptyState>
        )}
      >
        {(item: { id: string; subject: string }) => <ListView.Item textValue={item.subject}>{item.subject}</ListView.Item>}
      </ListView>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Empty />
    </div>
  );
}
