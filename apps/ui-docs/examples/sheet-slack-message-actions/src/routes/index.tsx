// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";
import { Bookmark, Copy, Forward, Heart, Laugh, Pin, Reply, ThumbsUp, Trash2 } from "lucide";

export const head = { title: "Sheet: Slack Message Actions" };

// #region demo
const QUICK = [
  { label: "Like", icon: ThumbsUp },
  { label: "Love", icon: Heart },
  { label: "Laugh", icon: Laugh },
];
const ACTIONS = [
  { label: "Reply in thread", icon: Reply },
  { label: "Forward message", icon: Forward },
  { label: "Copy link", icon: Copy },
  { label: "Pin to channel", icon: Pin },
  { label: "Save for later", icon: Bookmark },
];

export function MessageActions() {
  const last = signal("none");
  return (
    <div class="flex flex-col items-center gap-3">
      <Sheet>
        <Button variant="secondary">Message actions</Button>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog aria-label="Message actions">
              <Sheet.Handle />
              <Sheet.Body class="flex flex-col gap-3">
                <div class="flex gap-2">
                  {QUICK.map((q) => (
                    <Button slot="close" isIconOnly variant="secondary" aria-label={q.label} onPress={() => last.set(q.label)}>
                      <Icon icon={q.icon} size={18} />
                    </Button>
                  ))}
                </div>
                <div class="flex flex-col">
                  {ACTIONS.map((a) => (
                    <Button slot="close" variant="ghost" class="justify-start gap-3" onPress={() => last.set(a.label)}>
                      <Icon icon={a.icon} size={18} />
                      {a.label}
                    </Button>
                  ))}
                  <Button slot="close" variant="ghost" class="justify-start gap-3 text-danger" onPress={() => last.set("Delete")}>
                    <Icon icon={Trash2} size={18} />
                    Delete message
                  </Button>
                </div>
              </Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <p class="text-sm text-muted">
        Last action: <span id="sheet-actions-last">{last()}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MessageActions />
    </div>
  );
}
