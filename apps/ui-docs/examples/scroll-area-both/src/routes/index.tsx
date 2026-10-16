// Rivet-authored ScrollArea demo (no HeroUI counterpart).
import { ScrollArea } from "@rivetjs/ui/scroll-area";

export const head = { title: "ScrollArea: Both axes" };

// #region demo
const rows = Array.from({ length: 30 }, (_, row) => Array.from({ length: 12 }, (_, col) => `${String.fromCharCode(65 + col)}${row + 1}`));

export function Both() {
  return (
    <ScrollArea class="h-72 w-80 rounded-xl border border-border">
      <ScrollArea.Viewport>
        <table class="text-sm">
          <tbody>
            {rows.map((cells) => (
              <tr>
                {cells.map((cell) => (
                  <td class="border-b border-separator px-4 py-2 whitespace-nowrap">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" />
      <ScrollArea.Scrollbar orientation="horizontal" />
      <ScrollArea.Corner />
    </ScrollArea>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Both />
    </div>
  );
}
