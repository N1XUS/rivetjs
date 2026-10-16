// Rivet-authored ScrollArea demo (no HeroUI counterpart).
import { Chip } from "@rivetjs/ui/chip";
import { ScrollArea } from "@rivetjs/ui/scroll-area";

export const head = { title: "ScrollArea: Horizontal tags" };

// #region demo
const topics = [
  "Design",
  "Accessibility",
  "Performance",
  "Resumability",
  "Signals",
  "Streaming SSR",
  "Compiler",
  "Routing",
  "Forms",
  "i18n",
  "Testing",
  "Theming",
];

export function Horizontal() {
  return (
    <ScrollArea class="w-80 rounded-xl border border-border">
      <ScrollArea.Viewport>
        <div class="flex w-max gap-2 p-4">
          {topics.map((topic) => (
            <Chip>{topic}</Chip>
          ))}
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="horizontal" />
    </ScrollArea>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Horizontal />
    </div>
  );
}
