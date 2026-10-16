// Rivet-authored ScrollArea demo (no HeroUI counterpart).
import { ScrollArea } from "@rivetjs/ui/scroll-area";

export const head = { title: "ScrollArea: Always visible" };

// #region demo
const items = Array.from({ length: 30 }, (_, i) => `Notification ${i + 1}`);

export function Always() {
  return (
    <div class="flex gap-6">
      <ScrollArea variant="always" class="h-64 w-48 rounded-xl border border-border">
        <ScrollArea.Viewport>
          <ul class="space-y-2 p-4 text-sm">
            {items.map((item) => (
              <li>{item}</li>
            ))}
          </ul>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" />
      </ScrollArea>
      <ScrollArea variant="always" size="sm" class="h-64 w-48 rounded-xl border border-border">
        <ScrollArea.Viewport>
          <ul class="space-y-2 p-4 text-sm">
            {items.map((item) => (
              <li>{item}</li>
            ))}
          </ul>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Always />
    </div>
  );
}
