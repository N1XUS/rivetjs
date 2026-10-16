// Rivet-authored ScrollArea demo (no HeroUI counterpart).
import { Separator } from "@rivetjs/ui/separator";
import { ScrollArea } from "@rivetjs/ui/scroll-area";

export const head = { title: "ScrollArea: Vertical list" };

// #region demo
const tags = Array.from({ length: 50 }, (_, i) => `v1.2.0-beta.${50 - i}`);

export function Vertical() {
  return (
    <ScrollArea class="h-72 w-48 rounded-xl border border-border">
      <ScrollArea.Viewport>
        <div class="p-4">
          <h4 class="mb-4 text-sm font-medium">Tags</h4>
          {tags.map((tag) => (
            <>
              <div class="text-sm">{tag}</div>
              <Separator class="my-2" />
            </>
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
      <Vertical />
    </div>
  );
}
