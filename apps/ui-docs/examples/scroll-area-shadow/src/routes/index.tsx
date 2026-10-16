// Rivet-authored ScrollArea demo (no HeroUI counterpart).
import { ScrollArea } from "@rivetjs/ui/scroll-area";

export const head = { title: "ScrollArea: With shadow" };

// #region demo
const LOREM =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis. Pellentesque sit amet hendrerit risus, sed porttitor quam.";

export function Shadow() {
  return (
    <ScrollArea shadow class="h-64 w-80 rounded-xl border border-border">
      <ScrollArea.Viewport>
        <div class="space-y-4 p-4 text-sm">
          {Array.from({ length: 8 }).map(() => (
            <p>{LOREM}</p>
          ))}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" />
    </ScrollArea>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shadow />
    </div>
  );
}
